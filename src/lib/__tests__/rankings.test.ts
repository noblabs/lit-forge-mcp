import { describe, expect, it } from "vitest";
import { rankByPerformance } from "../rankings.js";
import type { Indicator, Quote, QuoteResult } from "../market-types.js";

function ind(symbol: string, name: string): Indicator {
  return {
    symbol,
    displayName: name,
    category: "equity",
    unit: "",
    decimals: 2,
    changeStyle: "ratio",
  };
}

function q(symbol: string, changePercent: number, perf?: { d7?: number; d30?: number }): Quote {
  return {
    symbol,
    price: 100,
    previousClose: 100,
    change: 0,
    changePercent,
    changeBp: 0,
    fetchedAt: "2026-05-01T00:00:00.000Z",
    sparkline: [100],
    performance: perf
      ? { d7: perf.d7 ?? null, d30: perf.d30 ?? null, d365: null }
      : undefined,
  };
}

describe("rankByPerformance", () => {
  const indicators = [ind("A", "AAA"), ind("B", "BBB"), ind("C", "CCC")];
  const quotes: Record<string, QuoteResult> = {
    A: q("A", 2.0, { d7: 5, d30: 10 }),
    B: q("B", -1.0, { d7: -3, d30: 8 }),
    C: q("C", 0.5, { d7: 7, d30: 2 }),
  };

  it("1d 期間で changePercent 降順", () => {
    const r = rankByPerformance(indicators, quotes, "1d");
    expect(r.map((x) => x.indicator.symbol)).toEqual(["A", "C", "B"]);
  });

  it("1w 期間で d7 降順", () => {
    const r = rankByPerformance(indicators, quotes, "1w");
    expect(r.map((x) => x.indicator.symbol)).toEqual(["C", "A", "B"]);
  });

  it("1m 期間で d30 降順", () => {
    const r = rankByPerformance(indicators, quotes, "1m");
    expect(r.map((x) => x.indicator.symbol)).toEqual(["A", "B", "C"]);
  });

  it("performance 無しは 1w/1m から除外される", () => {
    const noPerf: Record<string, QuoteResult> = {
      A: q("A", 2.0),
      B: q("B", -1.0, { d7: 3 }),
    };
    const r = rankByPerformance(indicators, noPerf, "1w");
    // A は performance なし、B のみ含まれる、C は quote 自体無い
    expect(r.length).toBe(1);
    expect(r[0].indicator.symbol).toBe("B");
  });

  it("error の quote は除外", () => {
    const errored: Record<string, QuoteResult> = {
      A: { error: "fail" },
      B: q("B", 5),
    };
    const r = rankByPerformance(indicators, errored, "1d");
    expect(r.length).toBe(1);
    expect(r[0].indicator.symbol).toBe("B");
  });
});
