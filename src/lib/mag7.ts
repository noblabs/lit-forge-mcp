// マグニフィセント 7：米株を牽引する大型テック 7 銘柄。
// 米株セクター ETF と並列に「個別株の強弱」セクションとして /today に表示する。

export type Mag7Stock = {
  symbol: string;
  // 短縮表示名（ヒートマップのセル幅が狭いため簡潔に）
  name: string;
  description: string;
};

export const MAG7_STOCKS: readonly Mag7Stock[] = [
  { symbol: "AAPL", name: "Apple", description: "iPhone・サービス事業" },
  { symbol: "MSFT", name: "Microsoft", description: "Azure・Office・OpenAI 出資" },
  { symbol: "GOOGL", name: "Alphabet", description: "検索・広告・YouTube・Cloud" },
  { symbol: "AMZN", name: "Amazon", description: "EC・AWS（クラウド最大手）" },
  { symbol: "META", name: "Meta", description: "Instagram・Facebook・WhatsApp" },
  { symbol: "NVDA", name: "Nvidia", description: "AI 向け GPU の中心企業" },
  { symbol: "TSLA", name: "Tesla", description: "EV・エネルギー貯蔵" },
];

export const MAG7_SYMBOLS: readonly string[] = MAG7_STOCKS.map((s) => s.symbol);
