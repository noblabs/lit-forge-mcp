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
  // v0.6.0 で追加。get_quote の includeFundamentals=true 時のみ埋まる
  fundamentals?: QuoteFundamentals;
};

// 株式のファンダメンタル指標（v0.6.0）。Yahoo Finance v10 quoteSummary 由来。
// 個別株以外（指数・暗号資産・FX 等）では大半が undefined になる。
export type QuoteFundamentals = {
  trailingPE?: number;
  forwardPE?: number;
  priceToBook?: number;
  // 配当利回り。0.0234 = 2.34%
  dividendYield?: number;
  // 配当性向。0.30 = 30%
  payoutRatio?: number;
  beta?: number;
  marketCap?: number;
  averageDailyVolume3M?: number;
};

// 配当履歴 1 件（v0.6.0）
export type DividendRecord = {
  // ISO 8601 日付（YYYY-MM-DD）
  date: string;
  amount: number;
};

// アナリストコンセンサス（v0.6.0）。Yahoo Finance v10 quoteSummary 由来。
export type AnalystConsensus = {
  // Yahoo の生の文字列。"strong_buy" / "buy" / "hold" / "sell" / "strong_sell" / "underperform" 等
  recommendationKey?: string;
  // recommendationKey を日本語化したラベル。例: "買い"、"中立"
  recommendationLabel?: string;
  // 1.0 (Strong Buy) ~ 5.0 (Strong Sell) のアナリスト平均
  recommendationMean?: number;
  targetMeanPrice?: number;
  targetHighPrice?: number;
  targetLowPrice?: number;
  numberOfAnalystOpinions?: number;
  // 直近 4 ヶ月分の月別推奨内訳（Yahoo の period: "0m", "-1m", "-2m", "-3m"）
  byMonth?: Array<{
    period: string;
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
  }>;
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
