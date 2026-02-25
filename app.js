async function fetchPrice(symbol, timeframe) {
  const base = window.APP_CONFIG.fxProxyBase;
  const url = `${base}/price?symbol=${symbol}&tf=${timeframe}`;
  const res = await fetch(url);
  return await res.json();
}

function calcWinrate(results){
  const wins = results.filter(r=>r.win).length;
  return wins / results.length;
}

async function generateSignal(){
  const cfg = window.APP_CONFIG;
  const symbol = cfg.symbols[0].key;
  const tf = cfg.timeframes[1];

  const data = await fetchPrice(symbol, tf.key);
  if(!data || !data.prices) return;

  const prices = data.prices.slice(-cfg.backtestBars);

  let results = [];

  for(let i=10;i<prices.length-1;i++){
    const up = prices[i] > prices[i-5];
    const win = up ? prices[i+1] > prices[i] : prices[i+1] < prices[i];
    results.push({win});
  }

  if(results.length < cfg.minSamples) return;

  let winrate = calcWinrate(results);

  // ベイズ補正
  winrate = (results.filter(r=>r.win).length + cfg.bayesA) / 
            (results.length + cfg.bayesA + cfg.bayesB);

  if(winrate < cfg.minWinrate) return;

  const direction = prices.at(-1) > prices.at(-5) ? "HIGH" : "LOW";

  document.getElementById("signals").innerHTML = `
    <div class="card">
      ${symbol} ${direction}<br>
      ${tf.key} / 勝率 ${(winrate*100).toFixed(1)}%<br>
      ${cfg.finalCheckSec}秒後にエントリー
    </div>
  `;

  if(Notification.permission==="granted"){
    new Notification(`${symbol} ${direction}`,{
      body:`${tf.key} 勝率 ${(winrate*100).toFixed(1)}%`
    });
  }
}

setInterval(generateSignal,5000);
