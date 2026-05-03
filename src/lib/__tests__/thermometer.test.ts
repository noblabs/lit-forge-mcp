import { describe, expect, it } from "vitest";
import {
  computeThermometer,
  computeThermometerHistory,
} from "../thermometer.js";
import type { Quote, Snapshot } from "../market-types.js";

function q(symbol: string, price: number, changePercent = 0, changeBp = 0): Quote {
  return {
    symbol,
    price,
    previousClose: price - (price * changePercent) / 100,
    change: (price * changePercent) / 100,
    changePercent,
    changeBp,
    fetchedAt: "2026-05-01T00:00:00.000Z",
    sparkline: [price],
  };
}

function snap(quotes: Record<string, Quote>): Snapshot {
  return { fetchedAt: "2026-05-01T00:00:00.000Z", quotes };
}

describe("computeThermometer", () => {
  it("典型的なリスクオン構成 → score >= 70、level=risk-on", () => {
    const s = snap({
      "^VIX": q("^VIX", 12, -5),
      "^GSPC": q("^GSPC", 5500, 1.2),
      "^TNX": q("^TNX", 4.5, 0, 8),
      "DX-Y.NYB": q("DX-Y.NYB", 105, -0.4),
    });
    const r = computeThermometer(s)!;
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.level).toBe("risk-on");
  });

  it("典型的なリスクオフ構成 → score <= 30、level=risk-off", () => {
    const s = snap({
      "^VIX": q("^VIX", 28, 8),
      "^GSPC": q("^GSPC", 5500, -1.4),
      "^TNX": q("^TNX", 4.5, 0, -8),
      "DX-Y.NYB": q("DX-Y.NYB", 105, 0.4),
    });
    const r = computeThermometer(s)!;
    expect(r.score).toBeLessThanOrEqual(30);
    expect(r.level).toBe("risk-off");
  });

  it("中立 → 30 < score < 70、level=neutral", () => {
    const s = snap({
      "^VIX": q("^VIX", 20, 0),
      "^GSPC": q("^GSPC", 5500, 0),
      "^TNX": q("^TNX", 4.5, 0, 0),
      "DX-Y.NYB": q("DX-Y.NYB", 105, 0),
    });
    const r = computeThermometer(s)!;
    expect(r.score).toBeCloseTo(50, 0);
    expect(r.level).toBe("neutral");
  });

  it("一部欠損でも平均を返す（部分縮退）", () => {
    const s = snap({
      "^VIX": q("^VIX", 15, 0),
      "^GSPC": q("^GSPC", 5500, 0.5),
    });
    const r = computeThermometer(s);
    expect(r).not.toBeNull();
    expect(r!.components).toHaveLength(4);
    // 取得できた 2 成分のみ平均
    const valid = r!.components.filter((c) => c.value !== null);
    expect(valid.length).toBe(2);
  });

  it("全成分欠損なら null", () => {
    expect(computeThermometer(snap({}))).toBeNull();
  });

  it("clamp: 極端値（VIX=5）でも 0..100 に収まる", () => {
    const s = snap({ "^VIX": q("^VIX", 5, 0) });
    const r = computeThermometer(s)!;
    expect(r.components[0].value!).toBeLessThanOrEqual(100);
    expect(r.components[0].value!).toBeGreaterThanOrEqual(0);
  });

  it("clamp: 極端値（VIX=80）でも 0..100 に収まる", () => {
    const s = snap({ "^VIX": q("^VIX", 80, 0) });
    const r = computeThermometer(s)!;
    expect(r.components[0].value!).toBeLessThanOrEqual(100);
    expect(r.components[0].value!).toBeGreaterThanOrEqual(0);
  });
});

describe("computeThermometerHistory", () => {
  function withCloses(symbol: string, closes: number[]): Quote {
    return { ...q(symbol, closes[closes.length - 1] ?? 0, 0, 0), closes1y: closes };
  }

  it("VIX のみの履歴でもスコアを返す", () => {
    const s: Snapshot = {
      fetchedAt: "2026-05-01T00:00:00.000Z",
      quotes: {
        "^VIX": withCloses("^VIX", [20, 18, 16, 14, 12]),
      },
    };
    const hist = computeThermometerHistory(s, 30);
    // i=1..4 の 4 点
    expect(hist.length).toBeGreaterThan(0);
    // VIX が下がるにつれてスコアは上がる（リスクオン化）
    expect(hist[hist.length - 1] > hist[0]).toBe(true);
  });

  it("4 成分すべて揃ってもスコア化できる", () => {
    const len = 50;
    const s: Snapshot = {
      fetchedAt: "2026-05-01T00:00:00.000Z",
      quotes: {
        "^VIX": withCloses("^VIX", Array.from({ length: len }, () => 20)),
        "^GSPC": withCloses(
          "^GSPC",
          Array.from({ length: len }, (_, i) => 5500 + i * 5),
        ),
        "^TNX": withCloses(
          "^TNX",
          Array.from({ length: len }, (_, i) => 4.5 + i * 0.001),
        ),
        "DX-Y.NYB": withCloses(
          "DX-Y.NYB",
          Array.from({ length: len }, () => 105),
        ),
      },
    };
    const hist = computeThermometerHistory(s, 30);
    expect(hist.length).toBe(30);
    for (const v of hist) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("データ無しなら空配列", () => {
    const s: Snapshot = { fetchedAt: "2026-05-01T00:00:00.000Z", quotes: {} };
    expect(computeThermometerHistory(s, 30)).toEqual([]);
  });
});
