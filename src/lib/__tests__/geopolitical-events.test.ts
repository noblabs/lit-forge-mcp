import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  GEOPOLITICAL_EVENTS,
  filterByCountry,
  filterBySubcategory,
  getGeopoliticalEventsForDate,
  getGeopoliticalEventsForMonth,
  getGeopoliticalEventsForWeek,
} from "../geopolitical-events.js";
import type { GeopoliticalEvent } from "../market-types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");

describe("GEOPOLITICAL_EVENTS data integrity", () => {
  it("date は yyyy-mm-dd 形式で正しい日付", () => {
    GEOPOLITICAL_EVENTS.forEach((e) => {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const d = new Date(`${e.date}T00:00:00+09:00`);
      expect(Number.isNaN(d.getTime())).toBe(false);
    });
  });

  it("endDate を持つ場合 date <= endDate", () => {
    GEOPOLITICAL_EVENTS.forEach((e) => {
      if (e.endDate) {
        expect(e.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(e.date <= e.endDate).toBe(true);
      }
    });
  });

  it("importance は 1, 2, 3 のいずれか", () => {
    GEOPOLITICAL_EVENTS.forEach((e) => {
      expect([1, 2, 3]).toContain(e.importance);
    });
  });

  it("subcategory は enum 値のいずれか", () => {
    const valid = new Set(["summit", "bilateral", "election", "risk"]);
    GEOPOLITICAL_EVENTS.forEach((e) => {
      expect(valid.has(e.subcategory)).toBe(true);
    });
  });

  it("source は enum 値のいずれか", () => {
    const valid = new Set(["official-jp", "official-intl", "private"]);
    GEOPOLITICAL_EVENTS.forEach((e) => {
      expect(valid.has(e.source)).toBe(true);
    });
  });

  it("id は全エントリで一意", () => {
    const ids = GEOPOLITICAL_EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sourceUrl は非空文字列", () => {
    GEOPOLITICAL_EVENTS.forEach((e) => {
      expect(typeof e.sourceUrl).toBe("string");
      expect(e.sourceUrl.trim().length).toBeGreaterThan(0);
    });
  });

  it("lastVerifiedAt は yyyy-mm-dd 形式", () => {
    GEOPOLITICAL_EVENTS.forEach((e) => {
      expect(e.lastVerifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it("marketImplications を持つ場合は object でフィールドは文字列のみ", () => {
    GEOPOLITICAL_EVENTS.forEach((e) => {
      if (e.marketImplications) {
        for (const [, v] of Object.entries(e.marketImplications)) {
          if (v !== undefined) {
            expect(typeof v).toBe("string");
          }
        }
      }
    });
  });
});

describe("地政学イベントは公式日程 JSON と一致する", () => {
  // verify:geopolitical と同じ TS ⊆ JSON 検証を vitest 側でも担保。
  // 比較キーは id（地政学は表記揺れが起きやすいため）。
  const SOURCES = [
    "data/geopolitical-events/summits.json",
    "data/geopolitical-events/bilateral-meetings.json",
    "data/geopolitical-events/elections.json",
    "data/geopolitical-events/risk-events.json",
  ];

  type JsonEvent = {
    id: string;
    publishDate: string;
    publishEndDate?: string;
    label: string;
  };

  function loadOfficialById(): Map<string, JsonEvent> {
    const map = new Map<string, JsonEvent>();
    for (const relPath of SOURCES) {
      const fullPath = join(REPO_ROOT, relPath);
      const data = JSON.parse(readFileSync(fullPath, "utf-8")) as {
        events: JsonEvent[];
      };
      for (const ev of data.events) {
        map.set(ev.id, ev);
      }
    }
    return map;
  }

  it("TS 地政学エントリは全て data/geopolitical-events/*.json に存在する", () => {
    const official = loadOfficialById();
    const missing = GEOPOLITICAL_EVENTS.filter((e) => !official.has(e.id));
    if (missing.length > 0) {
      const detail = missing.map(
        (e) => `id=${e.id} ${e.date} ★${e.importance} ${e.name}`,
      );
      throw new Error(
        `公式日程 JSON に存在しない TS 地政学エントリが ${missing.length} 件:\n${detail.join("\n")}`,
      );
    }
    expect(missing).toEqual([]);
  });

  it("同一 id で TS の date / endDate / name が JSON と一致する", () => {
    const official = loadOfficialById();
    const mismatched: string[] = [];
    for (const e of GEOPOLITICAL_EVENTS) {
      const j = official.get(e.id);
      if (!j) continue; // 上のテストで既に失敗するので skip
      if (j.publishDate !== e.date) {
        mismatched.push(
          `${e.id}: TS date=${e.date} ≠ JSON publishDate=${j.publishDate}`,
        );
      }
      const tsEnd = e.endDate ?? null;
      const jsonEnd = j.publishEndDate ?? null;
      if (tsEnd !== jsonEnd) {
        mismatched.push(
          `${e.id}: TS endDate=${tsEnd} ≠ JSON publishEndDate=${jsonEnd}`,
        );
      }
      if (j.label !== e.name) {
        mismatched.push(`${e.id}: TS name=${e.name} ≠ JSON label=${j.label}`);
      }
    }
    expect(mismatched).toEqual([]);
  });
});

describe("期間イベント (endDate) のヒット判定", () => {
  const periodEvents: GeopoliticalEvent[] = [
    {
      id: "test-bilateral-1",
      date: "2026-05-11",
      endDate: "2026-05-13",
      country: "US",
      name: "テスト訪日",
      subcategory: "bilateral",
      importance: 2,
      source: "official-jp",
      sourceUrl: "https://example.com",
      lastVerifiedAt: "2026-05-13",
    },
    {
      id: "test-summit-1",
      date: "2026-06-14",
      endDate: "2026-06-16",
      country: "OTHER",
      name: "テスト G7 サミット",
      subcategory: "summit",
      importance: 3,
      source: "official-intl",
      sourceUrl: "https://example.com",
      lastVerifiedAt: "2026-05-13",
    },
  ];

  it("開始日でヒットする", () => {
    const events = getGeopoliticalEventsForDate("2026-05-11", periodEvents);
    expect(events.some((e) => e.id === "test-bilateral-1")).toBe(true);
  });

  it("中日でヒットする", () => {
    const events = getGeopoliticalEventsForDate("2026-05-12", periodEvents);
    expect(events.some((e) => e.id === "test-bilateral-1")).toBe(true);
  });

  it("終了日でヒットする", () => {
    const events = getGeopoliticalEventsForDate("2026-05-13", periodEvents);
    expect(events.some((e) => e.id === "test-bilateral-1")).toBe(true);
  });

  it("開始前日ではヒットしない", () => {
    const events = getGeopoliticalEventsForDate("2026-05-10", periodEvents);
    expect(events.some((e) => e.id === "test-bilateral-1")).toBe(false);
  });

  it("終了翌日ではヒットしない", () => {
    const events = getGeopoliticalEventsForDate("2026-05-14", periodEvents);
    expect(events.some((e) => e.id === "test-bilateral-1")).toBe(false);
  });

  it("getGeopoliticalEventsForWeek は週レンジに重なれば含める", () => {
    const partial = getGeopoliticalEventsForWeek("2026-05-13", periodEvents);
    expect(partial.some((e) => e.id === "test-bilateral-1")).toBe(true);
    const noOverlap = getGeopoliticalEventsForWeek("2026-05-14", periodEvents);
    expect(noOverlap.some((e) => e.id === "test-bilateral-1")).toBe(false);
  });

  it("getGeopoliticalEventsForMonth は 30 日窓に含まれるイベントを返す", () => {
    // 5/11 起点なら 5/11〜6/9 が範囲。G7 6/14 は範囲外
    const month1 = getGeopoliticalEventsForMonth("2026-05-11", periodEvents);
    expect(month1.some((e) => e.id === "test-bilateral-1")).toBe(true);
    expect(month1.some((e) => e.id === "test-summit-1")).toBe(false);

    // 5/16 起点なら 5/16〜6/14 で G7 6/14 が末尾でヒット
    const month2 = getGeopoliticalEventsForMonth("2026-05-16", periodEvents);
    expect(month2.some((e) => e.id === "test-summit-1")).toBe(true);
  });

  it("ベッセント訪日 (本物データ) が 5/11・5/12・5/13 でヒットする", () => {
    const days = ["2026-05-11", "2026-05-12", "2026-05-13"];
    days.forEach((d) => {
      const events = getGeopoliticalEventsForDate(d);
      const hit = events.some((e) => e.name.includes("ベッセント"));
      expect(hit, `日付 ${d} でベッセント訪日がヒットしない`).toBe(true);
    });
  });
});

describe("filterBySubcategory", () => {
  const mixed: GeopoliticalEvent[] = [
    {
      id: "s1",
      date: "2026-06-14",
      country: "OTHER",
      name: "サミット",
      subcategory: "summit",
      importance: 3,
      source: "official-intl",
      sourceUrl: "https://example.com",
      lastVerifiedAt: "2026-05-13",
    },
    {
      id: "b1",
      date: "2026-05-11",
      country: "US",
      name: "二国間",
      subcategory: "bilateral",
      importance: 2,
      source: "official-jp",
      sourceUrl: "https://example.com",
      lastVerifiedAt: "2026-05-13",
    },
    {
      id: "e1",
      date: "2026-09-01",
      country: "JP",
      name: "選挙",
      subcategory: "election",
      importance: 2,
      source: "official-jp",
      sourceUrl: "https://example.com",
      lastVerifiedAt: "2026-05-13",
    },
  ];

  it("subcategories 未指定なら全件返す", () => {
    expect(filterBySubcategory(mixed, undefined)).toHaveLength(3);
  });

  it("空配列なら全件返す", () => {
    expect(filterBySubcategory(mixed, [])).toHaveLength(3);
  });

  it("summit のみ", () => {
    const r = filterBySubcategory(mixed, ["summit"]);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("s1");
  });

  it("複数指定の OR フィルタ", () => {
    const r = filterBySubcategory(mixed, ["bilateral", "election"]);
    expect(r.map((e) => e.id).sort()).toEqual(["b1", "e1"]);
  });
});

describe("filterByCountry", () => {
  const mixed: GeopoliticalEvent[] = [
    {
      id: "jp1",
      date: "2026-05-11",
      country: "JP",
      name: "日本",
      subcategory: "bilateral",
      importance: 2,
      source: "official-jp",
      sourceUrl: "https://example.com",
      lastVerifiedAt: "2026-05-13",
    },
    {
      id: "us1",
      date: "2026-05-11",
      country: "US",
      name: "米国",
      subcategory: "bilateral",
      importance: 2,
      source: "official-jp",
      sourceUrl: "https://example.com",
      lastVerifiedAt: "2026-05-13",
    },
  ];

  it("countries 未指定なら全件返す", () => {
    expect(filterByCountry(mixed, undefined)).toHaveLength(2);
  });

  it("JP のみ", () => {
    const r = filterByCountry(mixed, ["JP"]);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("jp1");
  });
});

describe("一次ソース比率の健全性", () => {
  it("source: 'private' のみのエントリは全体の 30% 未満（CONTRIBUTING ルール）", () => {
    if (GEOPOLITICAL_EVENTS.length === 0) {
      // データが空なら検証不要
      expect(true).toBe(true);
      return;
    }
    const privateOnly = GEOPOLITICAL_EVENTS.filter(
      (e) => e.source === "private",
    ).length;
    const ratio = privateOnly / GEOPOLITICAL_EVENTS.length;
    expect(ratio).toBeLessThan(0.3);
  });
});
