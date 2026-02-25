window.APP_CONFIG = {
  fxProxyBase: "https://binary-senyo-proxy.abc123.workers.dev",

  symbols: [
    { key: "BTCUSDT", label: "BTC/USD（実データ）" },
    { key: "ETHUSDT", label: "ETH/USD（実データ）" },
    { key: "USDJPY", label: "USD/JPY" },
    { key: "EURUSD", label: "EUR/USD" },
    { key: "EURJPY", label: "EUR/JPY" },
    { key: "AUDJPY", label: "AUD/JPY" },
    { key: "GBPJPY", label: "GBP/JPY" },
    { key: "AUDUSD", label: "AUD/USD" },
    { key: "NZDJPY", label: "NZD/JPY" },
  ],

  timeframes: [
    { key: "15s", sec: 15 },
    { key: "30s", sec: 30 },
    { key: "1m",  sec: 60 },
    { key: "3m",  sec: 180 },
    { key: "5m",  sec: 300 },
  ],

  minWinrate: 0.70,
  minSamples: 30,
  bayesA: 1,
  bayesB: 2,
  volaSpikeMult: 2.0,
  finalCheckSec: 5,
  backtestBars: 600,
};
