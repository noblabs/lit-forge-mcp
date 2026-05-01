import { describe, expect, it } from "vitest";
import { lastSMA, rollingSMA } from "../sma.js";

describe("rollingSMA", () => {
  it("先頭 N-1 個は null、N 番目以降は移動平均", () => {
    const r = rollingSMA([1, 2, 3, 4, 5], 3);
    expect(r).toEqual([null, null, 2, 3, 4]);
  });

  it("window=1 は元の配列と同じ", () => {
    expect(rollingSMA([10, 20, 30], 1)).toEqual([10, 20, 30]);
  });

  it("空配列は空", () => {
    expect(rollingSMA([], 3)).toEqual([]);
  });
});

describe("lastSMA", () => {
  it("末尾 N 個の平均を返す", () => {
    expect(lastSMA([1, 2, 3, 4, 5], 3)).toBeCloseTo(4, 5); // (3+4+5)/3
  });

  it("点数不足は null", () => {
    expect(lastSMA([1, 2], 3)).toBeNull();
  });

  it("window=length は全平均", () => {
    expect(lastSMA([10, 20, 30], 3)).toBe(20);
  });
});
