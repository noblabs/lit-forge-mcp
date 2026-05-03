// 米イールドカーブの傾き（^TNX - ^FVX）を計算する純関数。
// 「今日のテーマ」やヘッダー脇のコンパクト表示で「米10y-5y スプレッド」を出すために使う。
//
// スプレッドは bp（ベーシスポイント、1bp = 0.01%）。プラスは順イールド（10y > 5y）。

import type { Quote, QuoteResult, Snapshot } from "./market-types.js";

export type YieldSpread = {
  // ^TNX - ^FVX の現在値（パーセントポイント）
  spread: number;
  // 同日の前日比 spread の変化（bp）
  spreadChangeBp: number;
};

function getQuote(snapshot: Snapshot, symbol: string): Quote | null {
  const q: QuoteResult | undefined = snapshot.quotes[symbol];
  if (!q || "error" in q) return null;
  return q;
}

export function computeYieldSpread(snapshot: Snapshot): YieldSpread | null {
  const tnx = getQuote(snapshot, "^TNX");
  const fvx = getQuote(snapshot, "^FVX");
  if (!tnx || !fvx) return null;
  const spread = tnx.price - fvx.price;
  const spreadChange = (tnx.change ?? 0) - (fvx.change ?? 0);
  return { spread, spreadChangeBp: spreadChange * 100 };
}
