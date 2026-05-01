// MCP server 用の市況データ型定義。
// Web 側 (lit-forge/app/lib/market/types.ts) と整合する形で同梱。
// v0.4 で構造を Web 側と同型にし、Snapshot.quotes を Record<symbol, QuoteResult> に変更。

export type IndicatorCategory =
  | "fx"
  | "equity"
  | "bond"
  | "commodity"
  | "crypto";
export type ChangeStyle = "ratio" | "bp";

export type Indicator = {
  symbol: string;
  fallback?: string;
  displayName: string;
  category: IndicatorCategory;
  unit: string;
  decimals: number;
  changeStyle: ChangeStyle;
};

// 5 営業日 / 約 1 ヶ月（21 営業日）/ 約 1 年（252 営業日）前と比較したパフォーマンス（%）
export type PerformanceWindow = {
  d7: number | null;
  d30: number | null;
  d365: number | null;
};

export type Quote = {
  symbol: string;
  // MCP server 固有のメタ（出力 JSON で利用、Web 側には無い）
  displayName?: string;
  category?: IndicatorCategory;
  unit?: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  changeBp: number;
  fetchedAt: string;
  sparkline: number[];
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  dayHigh?: number;
  dayLow?: number;
  volume?: number;
  performance?: PerformanceWindow;
  closes1y?: number[];
  isStale?: boolean;
};

export type QuoteResult = Quote | { error: string };

export type Snapshot = {
  fetchedAt: string;
  quotes: Record<string, QuoteResult>;
};

export type EventImportance = 1 | 2 | 3;
export type Country = "JP" | "US" | "CN" | "EU" | "GB" | "OTHER";

export type EconomicEvent = {
  date: string;
  time?: string;
  country: Country;
  name: string;
  importance: EventImportance;
  note?: string;
  forecast?: string;
  actual?: string;
  previous?: string;
};
