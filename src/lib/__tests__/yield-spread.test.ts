import { describe, expect, it } from "vitest";
import { computeYieldSpread } from "../yield-spread.js";
import type { Quote, Snapshot } from "../market-types.js";

function q(symbol: string, price: number, change: number = 0): Quote {
  return {
    symbol,
    price,
    previousClose: price - change,
    change,
    changePercent: 0,
    changeBp: change * 100,
    fetchedAt: "",
    sparkline: [],
  };
}

describe("computeYieldSpread", () => {
  it("^TNX - ^FVX を返す", () => {
    const snap: Snapshot = {
      fetchedAt: "",
      quotes: {
        "^TNX": q("^TNX", 4.5, 0.01),
        "^FVX": q("^FVX", 4.2, 0.005),
      },
    };
    const r = computeYieldSpread(snap)!;
    expect(r.spread).toBeCloseTo(0.3, 5);
    expect(r.spreadChangeBp).toBeCloseTo(0.5, 2);
  });

  it("片方欠損は null", () => {
    const snap: Snapshot = {
      fetchedAt: "",
      quotes: { "^TNX": q("^TNX", 4.5) },
    };
    expect(computeYieldSpread(snap)).toBeNull();
  });

  it("error は null", () => {
    const snap: Snapshot = {
      fetchedAt: "",
      quotes: {
        "^TNX": q("^TNX", 4.5),
        "^FVX": { error: "fail" },
      },
    };
    expect(computeYieldSpread(snap)).toBeNull();
  });
});
