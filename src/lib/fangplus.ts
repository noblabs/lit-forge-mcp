// NYSE FANG+ 指数の構成銘柄（10 社・等加重）。
// 指数は四半期ごとに rebalance され rotational members が入れ替わるため、
// 表示は「2026 年時点の代表的 10 銘柄」を運用上の固定リストとして扱う。
// Mag7 と 7 銘柄が重複するが、FANG+ 独自の 3 銘柄（NFLX / AVGO / CRWD）も含めて
// FANG+ 指数（^NYFANG）を実際に動かしている個別株を一覧で見られるようにする。

export type FangPlusStock = {
  symbol: string;
  name: string;
  description: string;
};

export const FANGPLUS_STOCKS: readonly FangPlusStock[] = [
  { symbol: "META", name: "Meta", description: "FANG+ オリジナル構成銘柄、SNS・広告" },
  { symbol: "AAPL", name: "Apple", description: "FANG+ オリジナル構成銘柄、ハードウェア・サービス" },
  { symbol: "AMZN", name: "Amazon", description: "FANG+ オリジナル構成銘柄、EC・AWS" },
  { symbol: "NFLX", name: "Netflix", description: "FANG+ オリジナル構成銘柄、ストリーミング" },
  { symbol: "GOOGL", name: "Alphabet", description: "FANG+ オリジナル構成銘柄、検索・広告・Cloud" },
  { symbol: "MSFT", name: "Microsoft", description: "Azure・Office・OpenAI 出資" },
  { symbol: "NVDA", name: "Nvidia", description: "AI 向け GPU の中心企業" },
  { symbol: "TSLA", name: "Tesla", description: "EV・エネルギー貯蔵" },
  { symbol: "AVGO", name: "Broadcom", description: "半導体・AI ASIC・VMware" },
  { symbol: "CRWD", name: "CrowdStrike", description: "クラウドネイティブ・セキュリティ" },
];

export const FANGPLUS_SYMBOLS: readonly string[] = FANGPLUS_STOCKS.map(
  (s) => s.symbol,
);
