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
// v0.7.0 で追加。macro=マクロ経済指標、geopolitical=要人訪問・首脳会談・地政学日程、policy=政治・政策イベント（選挙・予算・サミット等）
// v0.17.0 で追加。centralbank=中銀高官の発言・講演（FRB 理事 / 地区連銀総裁 / 日銀審議委員 / ECB 専務理事等）。
//   指標・金融政策会合とは別系統。予定が流動的なため注目度の高いものだけ手動で随時追記する。
export type EventCategory = "macro" | "geopolitical" | "policy" | "centralbank";

export type EconomicEvent = {
  date: string;
  // v0.7.0 で追加。期間イベント（要人訪問・サミット等）の終了日。省略時は単日イベント
  endDate?: string;
  time?: string;
  country: Country;
  name: string;
  importance: EventImportance;
  // v0.7.0 で追加。省略時は "macro" 扱い（後方互換）
  category?: EventCategory;
  // v0.17.0 で追加。category: "centralbank" の発言イベントで使う発言者メタ。
  // speaker=発言者名（例: "ローガン" / "クック"）。
  speaker?: string;
  // speakerRole=役職（例: "ダラス連銀総裁" / "FRB 理事" / "日銀審議委員"）。
  speakerRole?: string;
  // votingMember=当該会合（FOMC / 日銀政策委員会 / ECB 理事会）での投票権の有無。
  //   投票権ありの発言ほど政策の方向性を示唆しやすく、市場インパクトの目安になる。
  votingMember?: boolean;
  note?: string;
  forecast?: string;
  actual?: string;
  previous?: string;
};

// v0.8.0 で追加。地政学イベントのサブカテゴリ。
// summit=国際サミット・国際会議 / bilateral=首脳会談・要人訪問 / election=主要国選挙 / risk=確定済みの地政学リスク日程（制裁・条約期限等）
export type GeopoliticalSubcategory = "summit" | "bilateral" | "election" | "risk";

// 一次ソース系統。official-jp=日本政府公式（首相官邸・外務省）/ official-intl=国際機関公式（G7/G20/IMF/NATO 等）/ private=民間集計（Reuters Diary 等）
export type GeopoliticalSourceTier = "official-jp" | "official-intl" | "private";

// 地政学イベント本体。EconomicEvent と別型にして地政学固有フィールドを必須化する。
// id は data/geopolitical-events/*.json との突合キー（verify:geopolitical で TS⊆JSON 検証）。
export type GeopoliticalEvent = {
  id: string;
  date: string;
  endDate?: string;
  time?: string;
  country: Country;
  name: string;
  subcategory: GeopoliticalSubcategory;
  importance: EventImportance;
  participants?: readonly string[];
  marketImplications?: {
    fx?: string;
    equity?: string;
    bond?: string;
    commodity?: string;
  };
  source: GeopoliticalSourceTier;
  sourceUrl: string;
  lastVerifiedAt: string;
  note?: string;
};
