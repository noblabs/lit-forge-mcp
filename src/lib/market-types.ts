// MCP server 用の市況データ型定義。
// Web 側 (lit-forge/app/lib/market/types.ts) と整合する形で同梱。

export type IndicatorCategory = "fx" | "equity" | "bond" | "commodity";
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

export type Quote = {
  symbol: string;
  displayName: string;
  category: IndicatorCategory;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  changeBp: number;
  unit: string;
  fetchedAt: string;
};

export type QuoteResult = Quote | { symbol: string; error: string };

export type Snapshot = {
  fetchedAt: string;
  quotes: QuoteResult[];
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
};
