// 米株セクター ETF（State Street Sector SPDR、11 銘柄）。
// 各セクターの前日比をコンパクトなヒートマップで表示し、米株市場の解像度を上げる。
// /today では INDICATORS（27 銘柄）と並行して別セクションで取得・表示する。

export type SectorEtf = {
  symbol: string;
  // セクター名（短縮、横長 11 グリッドで使う）
  name: string;
  // 主な構成（説明文、tooltip 等）
  description: string;
};

export const SECTOR_ETFS: readonly SectorEtf[] = [
  {
    symbol: "XLK",
    name: "テクノロジー",
    description: "Apple / Microsoft / Nvidia など。AI・半導体・SaaS",
  },
  {
    symbol: "XLF",
    name: "金融",
    description: "JPMorgan / Bank of America など。銀行・保険・証券",
  },
  {
    symbol: "XLV",
    name: "ヘルスケア",
    description: "UnitedHealth / J&J / Eli Lilly など。製薬・医療機器",
  },
  {
    symbol: "XLY",
    name: "一般消費財",
    description: "Amazon / Tesla / McDonald's など。景気敏感セクター",
  },
  {
    symbol: "XLP",
    name: "生活必需品",
    description: "P&G / Coca-Cola / Walmart など。ディフェンシブ",
  },
  {
    symbol: "XLE",
    name: "エネルギー",
    description: "ExxonMobil / Chevron など。原油価格と連動",
  },
  {
    symbol: "XLI",
    name: "資本財",
    description: "Boeing / Caterpillar / GE など。製造業・防衛",
  },
  {
    symbol: "XLU",
    name: "公益",
    description: "電力・ガス・水道。低 β のディフェンシブ",
  },
  {
    symbol: "XLB",
    name: "素材",
    description: "化学・鉱業・金属。Linde / Sherwin-Williams など",
  },
  {
    symbol: "XLRE",
    name: "不動産",
    description: "REIT 中心。金利感応度が高い",
  },
  {
    symbol: "XLC",
    name: "通信",
    description: "Meta / Alphabet / Netflix など。メディア・通信",
  },
];

export const SECTOR_SYMBOLS: readonly string[] = SECTOR_ETFS.map((s) => s.symbol);
