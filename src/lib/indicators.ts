// MCP server で扱うマクロ指標 9 銘柄。
// Web 側 (lit-forge/app/lib/market/indicators.ts) と同期管理。

import type { Indicator } from "./market-types.js";

export const INDICATORS: readonly Indicator[] = [
  { symbol: "JPY=X", displayName: "USD/JPY", category: "fx", unit: "円", decimals: 2, changeStyle: "ratio" },
  { symbol: "EURJPY=X", displayName: "EUR/JPY", category: "fx", unit: "円", decimals: 2, changeStyle: "ratio" },
  { symbol: "^N225", displayName: "日経平均", category: "equity", unit: "", decimals: 2, changeStyle: "ratio" },
  { symbol: "^TPX", fallback: "1305.T", displayName: "TOPIX", category: "equity", unit: "", decimals: 2, changeStyle: "ratio" },
  { symbol: "^GSPC", displayName: "S&P 500", category: "equity", unit: "", decimals: 2, changeStyle: "ratio" },
  { symbol: "^NDX", displayName: "NASDAQ 100", category: "equity", unit: "", decimals: 2, changeStyle: "ratio" },
  { symbol: "^TNX", displayName: "米10年債利回り", category: "bond", unit: "%", decimals: 3, changeStyle: "bp" },
  { symbol: "GC=F", displayName: "金（先物）", category: "commodity", unit: "USD/oz", decimals: 2, changeStyle: "ratio" },
  { symbol: "CL=F", displayName: "原油 WTI", category: "commodity", unit: "USD/bbl", decimals: 2, changeStyle: "ratio" },
];
