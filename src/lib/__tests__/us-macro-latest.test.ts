// us-macro-latest の純粋関数テスト。
// ネットワーク fetch は実 API に依存するため対象外。summarizeSeries の
// 正規化・前月比・前年比計算ロジックのみ検証する。

import { describe, it, expect } from "vitest";
import { summarizeSeries, type BlsSeriesDatum } from "../us-macro-latest.js";

const NFP_DEF = {
  id: "CES0000000001",
  key: "nonfarmPayrolls" as const,
  displayName: "米 雇用統計（非農業部門就業者数）",
  unit: "千人",
};

const UR_DEF = {
  id: "LNS14000000",
  key: "unemploymentRate" as const,
  displayName: "米 失業率",
  unit: "%",
};

const CPI_DEF = {
  id: "CUUR0000SA0",
  key: "cpi" as const,
  displayName: "米 CPI（都市部全消費者、1982-84=100）",
  unit: "index",
};

// 雇用統計の data 例（新しい→古い順）。実 API レスポンスを模した最小サンプル。
const NFP_DATA: BlsSeriesDatum[] = [
  {
    year: "2026",
    period: "M04",
    periodName: "April",
    value: "158736",
    latest: "true",
    footnotes: [{ code: "P", text: "preliminary" }],
  },
  { year: "2026", period: "M03", periodName: "March", value: "158621", footnotes: [{}] },
  { year: "2026", period: "M02", periodName: "February", value: "158436", footnotes: [{}] },
  { year: "2026", period: "M01", periodName: "January", value: "158592", footnotes: [{}] },
  { year: "2025", period: "M12", periodName: "December", value: "158432", footnotes: [{}] },
  { year: "2025", period: "M04", periodName: "April", value: "158485", footnotes: [{}] },
];

describe("summarizeSeries (雇用統計)", () => {
  const r = summarizeSeries(NFP_DEF, NFP_DATA);

  it("latest フラグの月を最新値として拾う", () => {
    expect(r.latest.year).toBe(2026);
    expect(r.latest.month).toBe(4);
    expect(r.latest.value).toBe(158736);
  });

  it("preliminary フラグを保持する", () => {
    expect(r.latest.preliminary).toBe(true);
  });

  it("前月差・前月比を正しく計算する", () => {
    // 158736 - 158621 = 115、115 / 158621 ≈ 0.0725%
    expect(r.monthOverMonth?.diff).toBe(115);
    expect(r.monthOverMonth?.percent).toBeCloseTo(0.073, 2);
  });

  it("前年同月差・前年同月比を正しく計算する", () => {
    // 158736 - 158485 = 251、251 / 158485 ≈ 0.158%
    expect(r.yearOverYear?.diff).toBe(251);
    expect(r.yearOverYear?.percent).toBeCloseTo(0.158, 2);
  });
});

describe("summarizeSeries (1 月: 前月＝前年 12 月)", () => {
  const data: BlsSeriesDatum[] = [
    { year: "2026", period: "M01", periodName: "January", value: "158592", latest: "true" },
    { year: "2025", period: "M12", periodName: "December", value: "158432" },
    { year: "2025", period: "M01", periodName: "January", value: "158268" },
  ];
  const r = summarizeSeries(NFP_DEF, data);

  it("前月は前年 12 月を参照する", () => {
    expect(r.monthOverMonth?.diff).toBe(160);
  });

  it("前年同月は 2025-01 を参照する", () => {
    expect(r.yearOverYear?.diff).toBe(324);
  });
});

describe("summarizeSeries (失業率 %)", () => {
  const data: BlsSeriesDatum[] = [
    { year: "2026", period: "M04", periodName: "April", value: "4.3", latest: "true" },
    { year: "2026", period: "M03", periodName: "March", value: "4.3" },
    { year: "2025", period: "M04", periodName: "April", value: "4.2" },
  ];
  const r = summarizeSeries(UR_DEF, data);

  it("単位 % でも数値として扱える", () => {
    expect(r.latest.value).toBe(4.3);
    expect(r.monthOverMonth?.diff).toBe(0);
    expect(r.yearOverYear?.diff).toBeCloseTo(0.1, 5);
  });
});

describe("summarizeSeries (CPI index)", () => {
  const data: BlsSeriesDatum[] = [
    { year: "2026", period: "M04", periodName: "April", value: "333.020", latest: "true" },
    { year: "2026", period: "M03", periodName: "March", value: "332.100" },
    { year: "2025", period: "M04", periodName: "April", value: "320.500" },
  ];
  const r = summarizeSeries(CPI_DEF, data);

  it("3 桁 index 値を保持する", () => {
    expect(r.latest.value).toBe(333.02);
  });

  it("前年同月比 % を正しく計算する", () => {
    // (333.02 - 320.5) / 320.5 * 100 ≈ 3.906%
    expect(r.yearOverYear?.percent).toBeCloseTo(3.906, 2);
  });
});

describe("summarizeSeries (データ欠損)", () => {
  it("value='-' の月は null として扱われ計算は最新値の比較相手として無視される", () => {
    const data: BlsSeriesDatum[] = [
      { year: "2025", period: "M11", periodName: "November", value: "4.5", latest: "true" },
      { year: "2025", period: "M10", periodName: "October", value: "-" }, // 政府閉鎖等で欠損
      { year: "2024", period: "M11", periodName: "November", value: "4.1" },
    ];
    const r = summarizeSeries(UR_DEF, data);
    expect(r.latest.value).toBe(4.5);
    // 前月欠損なので monthOverMonth は diff=null・percent=null
    expect(r.monthOverMonth?.diff).toBeNull();
    expect(r.monthOverMonth?.percent).toBeNull();
    // 前年同月はあるので yearOverYear は値が入る
    expect(r.yearOverYear?.diff).toBeCloseTo(0.4, 5);
  });

  it("空 data でもエラーにならず空サマリを返す", () => {
    const r = summarizeSeries(NFP_DEF, []);
    expect(r.latest.value).toBeNull();
    expect(r.latest.month).toBe(0);
    expect(r.monthOverMonth).toBeUndefined();
    expect(r.yearOverYear).toBeUndefined();
  });

  it("最新月の value が '-' でも latest 情報は維持する", () => {
    const data: BlsSeriesDatum[] = [
      { year: "2026", period: "M04", periodName: "April", value: "-", latest: "true" },
    ];
    const r = summarizeSeries(NFP_DEF, data);
    expect(r.latest.year).toBe(2026);
    expect(r.latest.month).toBe(4);
    expect(r.latest.value).toBeNull();
    expect(r.monthOverMonth).toBeUndefined();
  });
});

describe("summarizeSeries (年間平均 M13 等の除外)", () => {
  it("M13（年間平均）レコードは除外され月次最新値を採用する", () => {
    const data: BlsSeriesDatum[] = [
      // M13 が data 先頭に紛れていても latest フラグ付きの月次レコードを優先
      { year: "2025", period: "M13", periodName: "Annual", value: "4.0" },
      { year: "2026", period: "M04", periodName: "April", value: "4.3", latest: "true" },
      { year: "2026", period: "M03", periodName: "March", value: "4.4" },
    ];
    const r = summarizeSeries(UR_DEF, data);
    expect(r.latest.month).toBe(4);
    expect(r.latest.value).toBe(4.3);
    expect(r.monthOverMonth?.diff).toBeCloseTo(-0.1, 5);
  });
});

describe("summarizeSeries (preliminary フラグ判定)", () => {
  it("footnotes に code P が無ければ preliminary=false", () => {
    const data: BlsSeriesDatum[] = [
      { year: "2026", period: "M03", periodName: "March", value: "158621", latest: "true", footnotes: [{}] },
    ];
    const r = summarizeSeries(NFP_DEF, data);
    expect(r.latest.preliminary).toBe(false);
  });

  it("footnotes が undefined でも preliminary=false", () => {
    const data: BlsSeriesDatum[] = [
      { year: "2026", period: "M03", periodName: "March", value: "158621", latest: "true" },
    ];
    const r = summarizeSeries(NFP_DEF, data);
    expect(r.latest.preliminary).toBe(false);
  });
});
