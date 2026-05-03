import { describe, expect, it } from "vitest";
import {
  correlationMatrix,
  pearson,
  tailReturns,
} from "../correlation.js";

describe("tailReturns", () => {
  it("末尾 31 件から 30 件のリターンを返す", () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i);
    const r = tailReturns(closes, 30);
    expect(r.length).toBe(30);
  });

  it("データ不足は空配列", () => {
    expect(tailReturns([100], 30)).toEqual([]);
    expect(tailReturns([], 30)).toEqual([]);
  });

  it("分母が 0（直前の close=0）の点を除外", () => {
    const r = tailReturns([100, 0, 50, 75], 10);
    // 100→0 (-100%)、0→50 は分母 0 で除外、50→75 (+50%) → 2 要素
    expect(r.length).toBe(2);
  });
});

describe("pearson", () => {
  it("完全に相関する系列は 1", () => {
    const a = Array.from({ length: 30 }, (_, i) => i / 100);
    const b = Array.from({ length: 30 }, (_, i) => i / 200);
    expect(pearson(a, b)).toBeCloseTo(1, 5);
  });

  it("完全に逆相関する系列は -1", () => {
    const a = Array.from({ length: 30 }, (_, i) => i / 100);
    const b = Array.from({ length: 30 }, (_, i) => -i / 100);
    expect(pearson(a, b)).toBeCloseTo(-1, 5);
  });

  it("点数不足は null", () => {
    expect(pearson([1, 2], [3, 4])).toBeNull();
  });

  it("片方が定数（std=0）は null", () => {
    const a = Array.from({ length: 30 }, () => 0.01);
    const b = Array.from({ length: 30 }, (_, i) => i / 100);
    expect(pearson(a, b)).toBeNull();
  });
});

describe("correlationMatrix", () => {
  it("対角線は 1（データ十分時）", () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i);
    const m = correlationMatrix(["A", "B"], () => closes);
    expect(m[0][0]).toBe(1);
    expect(m[1][1]).toBe(1);
  });

  it("対称行列", () => {
    const a = Array.from({ length: 50 }, (_, i) => 100 + i);
    const b = Array.from({ length: 50 }, (_, i) => 200 - i);
    const m = correlationMatrix(["A", "B"], (s) => (s === "A" ? a : b));
    expect(m[0][1]).toBeCloseTo(m[1][0]!, 5);
  });
});
