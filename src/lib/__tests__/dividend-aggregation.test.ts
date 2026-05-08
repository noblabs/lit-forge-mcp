import { describe, expect, it } from "vitest";
import { aggregateDividendsByYear } from "../yahoo.js";
import type { DividendRecord } from "../market-types.js";

describe("aggregateDividendsByYear", () => {
  it("空配列は空オブジェクトを返す", () => {
    expect(aggregateDividendsByYear([])).toEqual({});
  });

  it("同年の配当は合算される", () => {
    const divs: DividendRecord[] = [
      { date: "2024-02-15", amount: 0.24 },
      { date: "2024-05-15", amount: 0.24 },
      { date: "2024-08-15", amount: 0.25 },
      { date: "2024-11-15", amount: 0.25 },
    ];
    const r = aggregateDividendsByYear(divs);
    expect(r[2024]).toBeCloseTo(0.98, 5);
  });

  it("複数年は年別に分かれる", () => {
    const divs: DividendRecord[] = [
      { date: "2023-12-15", amount: 0.46 },
      { date: "2024-03-15", amount: 0.48 },
      { date: "2024-06-15", amount: 0.48 },
    ];
    const r = aggregateDividendsByYear(divs);
    expect(r[2023]).toBeCloseTo(0.46, 5);
    expect(r[2024]).toBeCloseTo(0.96, 5);
  });

  it("不正な日付フォーマットはスキップされる", () => {
    const divs: DividendRecord[] = [
      { date: "abcd-01-01", amount: 1 },
      { date: "2024-01-01", amount: 0.5 },
    ];
    const r = aggregateDividendsByYear(divs);
    expect(r[2024]).toBe(0.5);
    expect(Object.keys(r).length).toBe(1);
  });
});
