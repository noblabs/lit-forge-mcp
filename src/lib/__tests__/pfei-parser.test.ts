// PFEI パーサーの純関数テスト。
// 実 PDF を pdftotext -layout で抽出した実テキスト断片を fixture として使用。

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePfei } from "../pfei-parser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(
  join(__dirname, "fixtures", "pfei-2026-bls-section.txt"),
  "utf-8",
);

const SOURCE_URL =
  "https://www.whitehouse.gov/wp-content/uploads/2025/09/pfei_schedule_release_dates_cy2026.pdf";

describe("parsePfei (2026 BLS fixture)", () => {
  const result = parsePfei(FIXTURE, SOURCE_URL);

  it("PDF タイトルから年を抽出する", () => {
    expect(result.year).toBe(2026);
  });

  it("source / sourceUrl を保持する", () => {
    expect(result.source).toMatch(/PFEI/);
    expect(result.sourceUrl).toBe(SOURCE_URL);
  });

  it("BLS 三大指標を全て抽出する", () => {
    const keys = result.indicators.map((i) => i.key).sort();
    expect(keys).toEqual(["cpi", "employment", "ppi"]);
  });

  it("各指標 12 ヶ月分のリリース日を返す", () => {
    for (const ind of result.indicators) {
      expect(ind.releases).toHaveLength(12);
      const months = ind.releases.map((r) => r.month);
      expect(months).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    }
  });

  it("雇用統計の発表日を正しく抽出する (PFEI 2026 原本)", () => {
    const emp = result.indicators.find((i) => i.key === "employment");
    expect(emp).toBeDefined();
    // PDF 原本: 9, 6, 6, 3, 8, 5, 2, 7, 4, 2, 6, 4
    expect(emp!.releases.map((r) => r.day)).toEqual([
      9, 6, 6, 3, 8, 5, 2, 7, 4, 2, 6, 4,
    ]);
  });

  it("CPI の発表日を正しく抽出する (PFEI 2026 原本)", () => {
    const cpi = result.indicators.find((i) => i.key === "cpi");
    expect(cpi).toBeDefined();
    // PDF 原本: 13, 11, 11, 10, 12, 10, 14, 12, 11, 14, 10, 10
    expect(cpi!.releases.map((r) => r.day)).toEqual([
      13, 11, 11, 10, 12, 10, 14, 12, 11, 14, 10, 10,
    ]);
  });

  it("PPI の発表日を正しく抽出する (PFEI 2026 原本)", () => {
    const ppi = result.indicators.find((i) => i.key === "ppi");
    expect(ppi).toBeDefined();
    // PDF 原本: 14, 12, 12, 14, 13, 11, 15, 13, 10, 15, 13, 15
    expect(ppi!.releases.map((r) => r.day)).toEqual([
      14, 12, 12, 14, 13, 11, 15, 13, 10, 15, 13, 15,
    ]);
  });

  it("全指標が BLS / 08:30 ET / previous month 属性を持つ", () => {
    for (const ind of result.indicators) {
      expect(ind.agency).toBe("BLS");
      expect(ind.timeEt).toBe("08:30");
      expect(ind.dataDescription).toMatch(/previous month/);
    }
  });

  it("妥当な日 (1-31) のみ含む", () => {
    for (const ind of result.indicators) {
      for (const r of ind.releases) {
        expect(r.day).toBeGreaterThanOrEqual(1);
        expect(r.day).toBeLessThanOrEqual(31);
      }
    }
  });
});

describe("parsePfei (エラーパス)", () => {
  it("年がないテキストは throw", () => {
    expect(() => parsePfei("no title here", SOURCE_URL)).toThrow(/year/);
  });

  it("BLS セクションがないテキストは throw", () => {
    const text =
      "PRINCIPAL FEDERAL ECONOMIC INDICATORS FOR 2026\n(no BLS section)";
    expect(() => parsePfei(text, SOURCE_URL)).toThrow(/BLS/);
  });
});
