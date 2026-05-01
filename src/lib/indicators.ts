// MCP server で扱うマクロ指標 28 銘柄。
// Web 側 (lit-forge/app/lib/market/indicators.ts) と同期管理。
// v0.4 で 9 → 28 銘柄に拡張（Web の v1.50 → v1.59 の拡張に追従）。

import type { Indicator } from "./market-types.js";

export const INDICATORS: readonly Indicator[] = [
  // ====== 為替 ======
  { symbol: "JPY=X", displayName: "USD/JPY", category: "fx", unit: "円", decimals: 2, changeStyle: "ratio" },
  { symbol: "EURJPY=X", displayName: "EUR/JPY", category: "fx", unit: "円", decimals: 2, changeStyle: "ratio" },
  { symbol: "GBPJPY=X", displayName: "GBP/JPY", category: "fx", unit: "円", decimals: 2, changeStyle: "ratio" },
  { symbol: "AUDJPY=X", displayName: "AUD/JPY", category: "fx", unit: "円", decimals: 2, changeStyle: "ratio" },
  { symbol: "EURUSD=X", displayName: "EUR/USD", category: "fx", unit: "", decimals: 4, changeStyle: "ratio" },
  { symbol: "CHFJPY=X", displayName: "CHF/JPY", category: "fx", unit: "円", decimals: 2, changeStyle: "ratio" },
  { symbol: "DX-Y.NYB", fallback: "DX=F", displayName: "ドル指数 (DXY)", category: "fx", unit: "", decimals: 2, changeStyle: "ratio" },

  // ====== 株式（日本） ======
  { symbol: "^N225", displayName: "日経平均", category: "equity", unit: "", decimals: 2, changeStyle: "ratio" },
  { symbol: "^TPX", fallback: "1305.T", displayName: "TOPIX", category: "equity", unit: "", decimals: 2, changeStyle: "ratio" },

  // ====== 株式（米） ======
  { symbol: "^DJI", displayName: "NY ダウ", category: "equity", unit: "", decimals: 2, changeStyle: "ratio" },
  { symbol: "^GSPC", displayName: "S&P 500", category: "equity", unit: "", decimals: 2, changeStyle: "ratio" },
  { symbol: "^NDX", displayName: "NASDAQ 100", category: "equity", unit: "", decimals: 2, changeStyle: "ratio" },
  { symbol: "^VIX", displayName: "VIX (恐怖指数)", category: "equity", unit: "", decimals: 2, changeStyle: "ratio" },
  { symbol: "^NYFANG", displayName: "NYSE FANG+", category: "equity", unit: "", decimals: 2, changeStyle: "ratio" },
  { symbol: "^SOX", displayName: "フィラデルフィア半導体 (SOX)", category: "equity", unit: "", decimals: 2, changeStyle: "ratio" },

  // ====== 株式（欧州） ======
  { symbol: "^GDAXI", displayName: "DAX", category: "equity", unit: "", decimals: 2, changeStyle: "ratio" },
  { symbol: "^FTSE", displayName: "FTSE 100", category: "equity", unit: "", decimals: 2, changeStyle: "ratio" },

  // ====== 株式（アジア） ======
  { symbol: "000001.SS", displayName: "上海総合", category: "equity", unit: "", decimals: 2, changeStyle: "ratio" },
  { symbol: "^HSI", displayName: "ハンセン", category: "equity", unit: "", decimals: 2, changeStyle: "ratio" },
  { symbol: "^KS11", displayName: "KOSPI", category: "equity", unit: "", decimals: 2, changeStyle: "ratio" },
  { symbol: "^BSESN", displayName: "SENSEX", category: "equity", unit: "", decimals: 2, changeStyle: "ratio" },

  // ====== 金利 ======
  { symbol: "^TNX", displayName: "米10年債利回り", category: "bond", unit: "%", decimals: 3, changeStyle: "bp" },
  { symbol: "^FVX", displayName: "米5年債利回り", category: "bond", unit: "%", decimals: 3, changeStyle: "bp" },

  // ====== コモディティ ======
  { symbol: "GC=F", displayName: "金（先物）", category: "commodity", unit: "USD/oz", decimals: 2, changeStyle: "ratio" },
  { symbol: "CL=F", displayName: "原油 WTI", category: "commodity", unit: "USD/bbl", decimals: 2, changeStyle: "ratio" },
  { symbol: "HG=F", displayName: "銅（先物）", category: "commodity", unit: "USD/lb", decimals: 3, changeStyle: "ratio" },

  // ====== 暗号資産 ======
  { symbol: "BTC-USD", displayName: "ビットコイン", category: "crypto", unit: "USD", decimals: 0, changeStyle: "ratio" },
  { symbol: "ETH-USD", displayName: "イーサリアム", category: "crypto", unit: "USD", decimals: 0, changeStyle: "ratio" },
];

export const CATEGORY_LABEL: Record<Indicator["category"], string> = {
  fx: "為替",
  equity: "株式",
  bond: "金利",
  commodity: "コモディティ",
  crypto: "暗号資産",
};
