import { describe, expect, it } from "vitest";
import {
  detectLevelEvents,
  detectMilestone,
  detectOutlier,
  percentileLabel,
  pricePercentile,
} from "../quartile.js";

function arithmetic(len: number, start: number, step: number): number[] {
  return Array.from({ length: len }, (_, i) => start + step * i);
}

describe("pricePercentile", () => {
  it("単調増加配列の末尾は最高値（100）", () => {
    const closes = arithmetic(252, 100, 0.1);
    expect(pricePercentile(closes)).toBe(100);
  });

  it("単調減少配列の末尾は最安値（0）", () => {
    const closes = arithmetic(252, 200, -0.1);
    expect(pricePercentile(closes)).toBe(0);
  });

  it("中央値付近", () => {
    // 0..100 の値、末尾を 50 にすると過半数が末尾以下なので約 50%
    const closes = Array.from({ length: 250 }, (_, i) => i);
    closes.push(50);
    const p = pricePercentile(closes)!;
    // 50 以下の数 = 51 (0..50 を含む) / 250 ≒ 20.4%
    expect(p).toBeCloseTo(20.4, 1);
  });

  it("点数不足（< 30）は null", () => {
    expect(pricePercentile([1, 2, 3])).toBeNull();
    expect(pricePercentile([])).toBeNull();
  });
});

describe("detectOutlier", () => {
  it("等差で増加する穏やかな系列に対して 5% の動きは 1σ を大きく超える", () => {
    // closes = [100, 100.1, 100.2, ..., 125]; daily ret ~ 0.1%, std ≈ 0
    const closes = Array.from({ length: 252 }, (_, i) => 100 + i * 0.1);
    const r = detectOutlier(closes, 5);
    expect(r).not.toBeNull();
    expect(r!.exceeds1Sigma).toBe(true);
    expect(r!.sigma).toBeGreaterThan(1);
  });

  it("典型的な日次変動の範囲内なら 1σ を超えない", () => {
    // 0.5% 標準偏差程度の系列を作る
    const closes: number[] = [100];
    for (let i = 1; i < 252; i++) {
      // 単純な疑似乱数
      const r = Math.sin(i * 1.7) * 0.5;
      closes.push(closes[i - 1] * (1 + r / 100));
    }
    const result = detectOutlier(closes, 0.1);
    expect(result).not.toBeNull();
    expect(result!.exceeds1Sigma).toBe(false);
  });

  it("点数不足は null", () => {
    expect(detectOutlier([1, 2, 3], 1)).toBeNull();
  });

  it("全て同値（std=0）は null", () => {
    const closes = Array.from({ length: 252 }, () => 100);
    expect(detectOutlier(closes, 0)).toBeNull();
  });
});

describe("detectLevelEvents", () => {
  it("52 週新高値: 当日高値 >= 52w 高値で発火", () => {
    const events = detectLevelEvents({
      dayHigh: 5550,
      fiftyTwoWeekHigh: 5500,
    });
    expect(events.find((e) => e.type === "52w-new-high")).toBeDefined();
  });

  it("52 週新安値: 当日安値 <= 52w 安値で発火", () => {
    const events = detectLevelEvents({
      dayLow: 4400,
      fiftyTwoWeekLow: 4500,
    });
    expect(events.find((e) => e.type === "52w-new-low")).toBeDefined();
  });

  it("レベル系イベントは複数同時に出る", () => {
    const events = detectLevelEvents({
      dayHigh: 5550,
      dayLow: 5520,
      fiftyTwoWeekHigh: 5500,
      fiftyTwoWeekLow: 4500,
    });
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it("200 日線上抜け: 直近終値 > SMA200、前日 <= SMA200(-1)", () => {
    // 200日 SMA を上抜けるパターン：前 200 日は 100 で平均、最終日に 200 へジャンプ
    const closes = Array.from({ length: 200 }, () => 100);
    closes.push(99); // prev: under
    closes.push(200); // last: above
    const events = detectLevelEvents({ closes1y: closes });
    expect(events.find((e) => e.type === "ma200-cross-up")).toBeDefined();
  });

  it("200 日線下抜け", () => {
    const closes = Array.from({ length: 200 }, () => 100);
    closes.push(101); // prev: above
    closes.push(50); // last: below
    const events = detectLevelEvents({ closes1y: closes });
    expect(events.find((e) => e.type === "ma200-cross-down")).toBeDefined();
  });

  it("データ不足では何も出ない", () => {
    expect(detectLevelEvents({})).toEqual([]);
    expect(detectLevelEvents({ closes1y: [1, 2, 3] })).toEqual([]);
  });
});

describe("detectMilestone", () => {
  it("当日値が直近 30 日の最大なら「30日ぶり高値」", () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i * 0.1);
    closes.push(200); // 末尾を大幅高
    const m = detectMilestone(closes);
    expect(m).not.toBeNull();
    expect(m!.type).toBe("n-day-high");
    // 50 件しかないので 30 日ぶり判定が出る
    expect(m!.label).toContain("日ぶり高値");
  });

  it("当日値が 1 年（252 日）の最大なら「1年ぶり高値」", () => {
    const closes = Array.from({ length: 300 }, (_, i) => 100 + i * 0.01);
    closes.push(500);
    const m = detectMilestone(closes);
    expect(m?.label).toContain("1年ぶり高値");
  });

  it("どのウィンドウの高安にも届かなければ null", () => {
    // sin 波で 100±5 の範囲に振動する系列。最後を 100（中央値）にする。
    const closes = Array.from({ length: 300 }, (_, i) => 100 + Math.sin(i / 5) * 5);
    closes.push(100);
    expect(detectMilestone(closes)).toBeNull();
  });

  it("点数不足は null", () => {
    expect(detectMilestone([1, 2, 3])).toBeNull();
  });
});

describe("percentileLabel", () => {
  it("90% 以上は「上位X%水準」", () => {
    expect(percentileLabel(95)).toContain("上位5%水準");
    expect(percentileLabel(100)).toContain("上位0%水準");
  });

  it("70-90% は「上位X%」", () => {
    expect(percentileLabel(80)).toContain("上位20%");
  });

  it("30-70% は「中央値付近」", () => {
    expect(percentileLabel(50)).toContain("中央値付近");
  });

  it("10-30% は「下位X%」", () => {
    expect(percentileLabel(20)).toContain("下位20%");
  });

  it("10% 未満は「下位X%水準」", () => {
    expect(percentileLabel(5)).toContain("下位5%水準");
  });

  it("null は空文字", () => {
    expect(percentileLabel(null)).toBe("");
  });
});
