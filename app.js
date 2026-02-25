(() => {
  const $ = (id) => document.getElementById(id);

  const elBtn = $("btnNotify");
  const elSymbol = $("selSymbol");
  const elTf = $("selTf");
  const elStatus = $("status");
  const elDetail = $("detail");
  const elBt = $("bt");
  const elSignals = $("signals");

  function setStatus(main, detail = "") {
    if (elStatus) elStatus.textContent = main;
    if (elDetail) elDetail.textContent = detail;
  }

  function cfg() {
    // config.js は window.APP_CONFIG を想定
    return window.APP_CONFIG || null;
  }

  function normalizeBaseUrl(u) {
    if (!u) return "";
    return String(u).replace(/\/+$/, "");
  }

  async function fetchJson(url, timeoutMs = 12000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      if (!json) throw new Error(`JSONではありません: ${text.slice(0, 200)}`);
      return json;
    } finally {
      clearTimeout(t);
    }
  }

  function backtest(prices, minSamples, bayesA, bayesB) {
    if (!Array.isArray(prices) || prices.length < 50) {
      return { ok: false, reason: "価格データが少なすぎます" };
    }
    const results = [];
    for (let i = 10; i < prices.length - 1; i++) {
      const mom = prices[i] - prices[i - 5];
      const dir = mom >= 0 ? "HIGH" : "LOW";
      const win = dir === "HIGH" ? (prices[i + 1] > prices[i]) : (prices[i + 1] < prices[i]);
      results.push(win ? 1 : 0);
    }
    if (results.length < minSamples) {
      return { ok: false, reason: `母数不足（${results.length} < ${minSamples}）` };
    }
    const wins = results.reduce((a, b) => a + b, 0);
    const n = results.length;
    const winrate = (wins + bayesA) / (n + bayesA + bayesB); // ベイズ補正
    return { ok: true, wins, n, winrate };
  }

  function detectVolaSpike(prices, mult = 2.0) {
    if (!Array.isArray(prices) || prices.length < 30) return { spike: false, ratio: 0 };
    const ranges = [];
    for (let i = 1; i < prices.length; i++) ranges.push(Math.abs(prices[i] - prices[i - 1]));
    const recent = ranges.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const base = ranges.slice(0, -5).reduce((a, b) => a + b, 0) / Math.max(1, (ranges.length - 5));
    const ratio = base > 0 ? recent / base : 0;
    return { spike: ratio >= mult, ratio };
  }

  function fillSelects() {
    const c = cfg();
    if (!c) throw new Error("APP_CONFIG が読み込めていません（config.js確認）");

    elSymbol.innerHTML = "";
    c.symbols.forEach((s) => {
      const op = document.createElement("option");
      op.value = s.key;
      op.textContent = s.label || s.key;
      elSymbol.appendChild(op);
    });

    elTf.innerHTML = "";
    c.timeframes.forEach((t) => {
      const op = document.createElement("option");
      op.value = t.key;
      op.textContent = t.key;
      elTf.appendChild(op);
    });
  }

  async function requestNotify() {
    if (!("Notification" in window)) {
      alert("このブラウザは通知に対応していません");
      return;
    }
    const perm = await Notification.requestPermission();
    alert(perm === "granted" ? "通知をONにしました" : "通知が許可されませんでした");
  }

  function notify(title, body) {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    new Notification(title, { body });
  }

  async function tick() {
    const c = cfg();
    if (!c) return;

    const base = normalizeBaseUrl(c.fxProxyBase);
    if (!base.startsWith("http")) {
      setStatus("設定エラー", "fxProxyBase が未設定です");
      return;
    }

    const symbol = elSymbol.value || c.symbols?.[0]?.key;
    const tf = elTf.value || c.timeframes?.[0]?.key;

    setStatus("取得中…", `${symbol} / ${tf}`);

    const url = `${base}/price?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}`;

    let data;
    try {
      data = await fetchJson(url);
    } catch (e) {
      setStatus("API接続エラー", String(e.message || e));
      elBt.textContent = "";
      elSignals.innerHTML = "";
      return;
    }

    const prices = data?.prices;
    if (!Array.isArray(prices) || prices.length < 50) {
      setStatus("データ不足", "prices配列が受け取れていません");
      elBt.textContent = JSON.stringify(data).slice(0, 200);
      elSignals.innerHTML = "";
      return;
    }

    const bt = backtest(
      prices.slice(-(c.backtestBars ?? 600)),
      c.minSamples ?? 30,
      c.bayesA ?? 1,
      c.bayesB ?? 2
    );

    const vola = detectVolaSpike(prices.slice(-Math.max(60, c.backtestBars ?? 600)), c.volaSpikeMult ?? 2.0);

    if (!bt.ok) {
      setStatus("待機中…", bt.reason);
      elBt.textContent = bt.reason;
      elSignals.innerHTML = "";
      return;
    }

    const winPct = (bt.winrate * 100).toFixed(1);
    elBt.textContent = `勝率 ${winPct}% / 母数 ${bt.n} / ベイズ補正`;

    const mom = prices.at(-1) - prices.at(-6);
    const direction = mom >= 0 ? "HIGH" : "LOW";

    const entrySec = c.finalCheckSec ?? 5;
    const minW = c.minWinrate ?? 0.7;
    const ok = bt.winrate >= minW;

    const volaText = vola.spike ? `⚠ ボラ急変（${vola.ratio.toFixed(2)}x）` : `ボラ安定（${vola.ratio.toFixed(2)}x）`;

    setStatus(ok ? "シグナル候補" : "待機中…", `${symbol} / ${tf} / ${volaText}`);

    if (ok) {
      elSignals.innerHTML = `
        <div class="card">
          <div style="font-size:18px;font-weight:700;">${symbol}：${direction}</div>
          <div>時間足：${tf}</div>
          <div>勝率：${winPct}%（閾値 ${(minW*100).toFixed(0)}%）</div>
          <div>${entrySec}秒後にエントリー</div>
          <div style="margin-top:6px;">${volaText}</div>
        </div>
      `;
      notify(`${symbol} ${direction}`, `${tf} 勝率${winPct}% / ${entrySec}秒後 / ${volaText}`);
    } else {
      elSignals.innerHTML = "";
    }
  }

  function boot() {
    try {
      fillSelects();
    } catch (e) {
      setStatus("初期化エラー", String(e.message || e));
      return;
    }

    elBtn?.addEventListener("click", requestNotify);
    elSymbol?.addEventListener("change", tick);
    elTf?.addEventListener("change", tick);

    tick();
    setInterval(tick, 5000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
