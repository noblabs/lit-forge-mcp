// 27 銘柄を期間別パフォーマンスでソートするランキング純関数。
// /today の PerformanceRanking で「上位 N / 下位 N」を表示するために使う。
//
// 期間：1d は changePercent、1w/1m は performance.d7 / d30 を使用。
// performance フィールドが無い銘柄は除外。

import type { Indicator, Quote, QuoteResult } from "./market-types.js";

export type RankingPeriod = "1d" | "1w" | "1m";

export type RankedItem = {
  indicator: Indicator;
  pct: number;
};

function getPctForPeriod(quote: Quote, period: RankingPeriod): number | null {
  if (period === "1d") return quote.changePercent;
  if (period === "1w") return quote.performance?.d7 ?? null;
  return quote.performance?.d30 ?? null;
}

// 全 INDICATORS から、指定期間のパフォーマンス降順で並べ替えた配列を返す。
// データ無し銘柄は除外。
export function rankByPerformance(
  indicators: readonly Indicator[],
  quotes: Record<string, QuoteResult>,
  period: RankingPeriod,
): RankedItem[] {
  const items: RankedItem[] = [];
  for (const ind of indicators) {
    const q = quotes[ind.symbol];
    if (!q || "error" in q) continue;
    const pct = getPctForPeriod(q, period);
    if (pct === null || Number.isNaN(pct)) continue;
    items.push({ indicator: ind, pct });
  }
  items.sort((a, b) => b.pct - a.pct);
  return items;
}
