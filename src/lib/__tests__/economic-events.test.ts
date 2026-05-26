import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ECONOMIC_EVENTS,
  filterByCategory,
  getEventsForDate,
  getEventsForWeek,
  jstDateKey,
} from "../economic-events.js";
import type { EconomicEvent } from "../market-types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// __dirname = src/lib/__tests__ → repo root は ../../../
const REPO_ROOT = join(__dirname, "..", "..", "..");

// JST 基準で曜日番号を返す（0=日曜, 6=土曜）。
function jstDayOfWeek(dateKey: string): number {
  // dateKey は yyyy-mm-dd（JST）。+09:00 を付けて Date 化する。
  const d = new Date(`${dateKey}T00:00:00+09:00`);
  // JST の曜日 = UTC+9 時点の日付の曜日。
  // Date オブジェクトは内部 UTC 保持なので、9 時間進めた値で曜日計算する。
  const jstMs = d.getTime() + 9 * 3600 * 1000;
  return new Date(jstMs).getUTCDay();
}

describe("ECONOMIC_EVENTS data integrity", () => {
  it("全イベントは土日に登録されていない（市場休場・地政学イベントのみ例外）", () => {
    const offenders = ECONOMIC_EVENTS.filter((e) => {
      const dow = jstDayOfWeek(e.date);
      const isWeekend = dow === 0 || dow === 6;
      // 例外: 名前に「休場」を含む祝日エントリは固定日のため土日もあり得る
      // （例: 米独立記念日 7/4 が土曜の年など）
      const isMarketClosure = e.name.includes("休場");
      // 例外: 地政学・政治イベント（訪問・サミット・選挙等）は土日開催あり得る
      const isNonMacro =
        (e.category ?? "macro") !== "macro";
      return isWeekend && !isMarketClosure && !isNonMacro;
    });
    if (offenders.length > 0) {
      // 失敗時に詳細を出すため map で整形
      const detail = offenders.map(
        (e) => `${e.date} ★${e.importance} ${e.name}`,
      );
      throw new Error(
        `土日に登録された経済指標が ${offenders.length} 件あります（土日発表は通常あり得ないため要確認）:\n` +
          detail.join("\n"),
      );
    }
    expect(offenders).toEqual([]);
  });

  it("米雇用統計は金曜または木曜（独立記念日繰上げ）でなければならない", () => {
    const nfp = ECONOMIC_EVENTS.filter(
      (e) => e.country === "US" && e.name.includes("雇用統計"),
    );
    expect(nfp.length).toBeGreaterThan(0);
    const offenders = nfp.filter((e) => {
      const dow = jstDayOfWeek(e.date);
      // 5=金曜, 4=木曜（米独立記念日前倒しなど）
      return dow !== 5 && dow !== 4;
    });
    if (offenders.length > 0) {
      const detail = offenders.map((e) => `${e.date} ${e.name}`);
      throw new Error(
        `米雇用統計が金曜・木曜以外に登録されています:\n${detail.join("\n")}`,
      );
    }
    expect(offenders).toEqual([]);
  });

  it("米 PCE 価格指数は平日（月-金）に登録される", () => {
    // BEA は月末近辺の平日（水・木・金）に発表する。曜日固定ではない。
    // 厳密な日付検証は describe("米マクロ指標イベントは公式日程 JSON と一致する") 側で実施。
    const pce = ECONOMIC_EVENTS.filter(
      (e) => e.country === "US" && e.name.includes("PCE"),
    );
    expect(pce.length).toBeGreaterThan(0);
    const offenders = pce.filter((e) => {
      const dow = jstDayOfWeek(e.date);
      return dow === 0 || dow === 6; // 土日のみ NG
    });
    if (offenders.length > 0) {
      const detail = offenders.map((e) => `${e.date} ${e.name}`);
      throw new Error(`米 PCE が土日に登録されています:\n${detail.join("\n")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("FOMC 結果発表は水曜（米国時間水曜午後 = JST 水曜深夜）でなければならない", () => {
    const fomcResult = ECONOMIC_EVENTS.filter(
      (e) => e.country === "US" && e.name.includes("FOMC 結果発表"),
    );
    expect(fomcResult.length).toBeGreaterThan(0);
    // time が "27:00" など 24+ 表記 = JST 翌日早朝 = 米水曜午後 → JST では木曜 0-3 時
    const offenders = fomcResult.filter((e) => {
      const dow = jstDayOfWeek(e.date);
      // time 27:00 表記の場合、e.date は会合 2 日目（米水曜）= JST 水曜
      return dow !== 3; // 3=水曜
    });
    if (offenders.length > 0) {
      const detail = offenders.map((e) => `${e.date} ${e.name}`);
      throw new Error(
        `FOMC 結果発表が水曜以外に登録されています:\n${detail.join("\n")}`,
      );
    }
    expect(offenders).toEqual([]);
  });

  it("date は yyyy-mm-dd 形式で正しい日付", () => {
    ECONOMIC_EVENTS.forEach((e) => {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const d = new Date(`${e.date}T00:00:00+09:00`);
      expect(Number.isNaN(d.getTime())).toBe(false);
    });
  });

  it("importance は 1, 2, 3 のいずれか", () => {
    ECONOMIC_EVENTS.forEach((e) => {
      expect([1, 2, 3]).toContain(e.importance);
    });
  });

  it("getEventsForDate は重要度降順でソートされる", () => {
    // 7/1 には ★3 (米 ISM 製造業, 日銀短観) と ★2 (中国 PMI) の 3 件がある
    const events = getEventsForDate("2026-07-01");
    expect(events.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < events.length; i++) {
      expect(events[i - 1].importance).toBeGreaterThanOrEqual(
        events[i].importance,
      );
    }
  });

  it("getEventsForWeek は 7 日間分を日付昇順で返す", () => {
    const events = getEventsForWeek("2026-05-08");
    // 5/8〜5/14 の範囲
    events.forEach((e) => {
      expect(e.date >= "2026-05-08" && e.date <= "2026-05-14").toBe(true);
    });
    for (let i = 1; i < events.length; i++) {
      expect(events[i - 1].date <= events[i].date).toBe(true);
    }
  });

  it("jstDateKey は JST 基準の yyyy-mm-dd を返す", () => {
    // UTC 2026-05-08T15:00 = JST 2026-05-09T00:00
    const utc = new Date("2026-05-08T15:00:00Z");
    expect(jstDateKey(utc)).toBe("2026-05-09");
  });
});

describe("期間イベント (endDate) のヒット判定", () => {
  // テスト専用の最小データセット。ECONOMIC_EVENTS への依存を避ける。
  const periodEvents: EconomicEvent[] = [
    {
      date: "2026-05-11",
      endDate: "2026-05-13",
      country: "US",
      name: "テスト訪日",
      importance: 2,
      category: "geopolitical",
    },
    {
      date: "2026-05-12",
      country: "US",
      name: "テスト単日マクロ",
      importance: 3,
    },
  ];

  it("開始日 5/11 で期間イベントがヒットする", () => {
    const events = getEventsForDate("2026-05-11", periodEvents);
    expect(events.some((e) => e.name === "テスト訪日")).toBe(true);
  });

  it("中日 5/12 で期間イベントがヒットする", () => {
    const events = getEventsForDate("2026-05-12", periodEvents);
    expect(events.some((e) => e.name === "テスト訪日")).toBe(true);
  });

  it("終了日 5/13 で期間イベントがヒットする", () => {
    const events = getEventsForDate("2026-05-13", periodEvents);
    expect(events.some((e) => e.name === "テスト訪日")).toBe(true);
  });

  it("開始前日 5/10 では期間イベントがヒットしない", () => {
    const events = getEventsForDate("2026-05-10", periodEvents);
    expect(events.some((e) => e.name === "テスト訪日")).toBe(false);
  });

  it("終了翌日 5/14 では期間イベントがヒットしない", () => {
    const events = getEventsForDate("2026-05-14", periodEvents);
    expect(events.some((e) => e.name === "テスト訪日")).toBe(false);
  });

  it("getEventsForWeek は期間イベントが週レンジに重なれば含める", () => {
    // 5/14〜5/20 の週には期間 5/11-5/13 は重ならない
    const noOverlap = getEventsForWeek("2026-05-14", periodEvents);
    expect(noOverlap.some((e) => e.name === "テスト訪日")).toBe(false);

    // 5/13〜5/19 の週には期間 5/11-5/13 が末尾 5/13 で重なる
    const partial = getEventsForWeek("2026-05-13", periodEvents);
    expect(partial.some((e) => e.name === "テスト訪日")).toBe(true);

    // 5/7〜5/13 の週には期間がすっぽり収まる
    const fullyContained = getEventsForWeek("2026-05-07", periodEvents);
    expect(fullyContained.some((e) => e.name === "テスト訪日")).toBe(true);
  });

  it("ジャクソンホール会議 (本物データ) が 8/27〜8/29 でヒットする", () => {
    // v0.8.0 で endDate を明示。期間ヒットの本物データ代表として残す。
    const days = ["2026-08-27", "2026-08-28", "2026-08-29"];
    days.forEach((d) => {
      const events = getEventsForDate(d);
      const hit = events.some((e) => e.name.includes("ジャクソンホール"));
      expect(hit, `日付 ${d} でジャクソンホール会議がヒットしない`).toBe(true);
    });
  });
});

describe("ECONOMIC_EVENTS から地政学カテゴリは v0.8.0 で分離済み", () => {
  it("category: 'geopolitical' のエントリは ECONOMIC_EVENTS に含まれない", () => {
    // v0.8.0 で地政学イベントは GEOPOLITICAL_EVENTS（src/lib/geopolitical-events.ts）に分離。
    // 誤って ECONOMIC_EVENTS に再混入することを防ぐ。
    const offenders = ECONOMIC_EVENTS.filter(
      (e) => e.category === "geopolitical",
    );
    if (offenders.length > 0) {
      const detail = offenders.map(
        (e) => `${e.date} ${e.name}`,
      );
      throw new Error(
        `ECONOMIC_EVENTS に geopolitical カテゴリのエントリが ${offenders.length} 件混入しています。GEOPOLITICAL_EVENTS に移してください:\n${detail.join("\n")}`,
      );
    }
    expect(offenders).toEqual([]);
  });
});

describe("中銀イベントは公式日程 JSON と一致する", () => {
  // 2026-05-11 に発生した「日銀 議事要旨 5/11 (実際は 5/12 主な意見)」の再発防止。
  // 種別取り違え + 日付ズレは vitest の形式チェックでは原理的に捕捉不能のため、
  // data/central-bank-schedules/*.json を一次ソースとして双方向ではなく一方向比較。
  const CENTRAL_BANK_KEYWORDS = ["日銀", "FOMC", "FRB 議長", "ECB"];
  const SOURCES = [
    "data/central-bank-schedules/boj.json",
    "data/central-bank-schedules/fomc.json",
    "data/central-bank-schedules/ecb.json",
  ];

  function loadOfficialKeys(): Set<string> {
    const keys = new Set<string>();
    for (const relPath of SOURCES) {
      const fullPath = join(REPO_ROOT, relPath);
      const data = JSON.parse(readFileSync(fullPath, "utf-8")) as {
        events: Array<{ publishDate: string; publishTime?: string; label: string }>;
      };
      for (const ev of data.events) {
        keys.add(`${ev.publishDate}|${ev.publishTime ?? ""}|${ev.label}`);
      }
    }
    return keys;
  }

  it("TS 中銀エントリは全て data/central-bank-schedules/*.json に存在する", () => {
    const officialKeys = loadOfficialKeys();
    const tsCentralBank = ECONOMIC_EVENTS.filter(
      (e) =>
        // 中銀高官の「発言」(category: "centralbank") は会合スケジュールではないため突合対象外。
        // 日銀審議委員・ECB 高官の発言は name に "日銀"/"ECB" を含みうるが JSON には載らない。
        e.category !== "centralbank" &&
        CENTRAL_BANK_KEYWORDS.some((kw) => e.name.includes(kw)),
    );
    expect(tsCentralBank.length).toBeGreaterThan(0);

    const missing = tsCentralBank.filter((e) => {
      const key = `${e.date}|${e.time ?? ""}|${e.name}`;
      return !officialKeys.has(key);
    });

    if (missing.length > 0) {
      const detail = missing.map(
        (e) => `${e.date} ${e.time ?? "(終日)"} ★${e.importance} ${e.name}`,
      );
      throw new Error(
        `公式日程 JSON に存在しない TS 中銀エントリが ${missing.length} 件あります（公式と種別/日付が一致しないか、JSON 側が未更新）:\n${detail.join("\n")}`,
      );
    }
    expect(missing).toEqual([]);
  });
});

describe("米マクロ指標イベントは公式日程 JSON と一致する", () => {
  // 2026-05-12 に発生した「米 CPI（4 月）5/13 (実際は 5/12)」の再発防止。
  // PPI/PCE/小売売上高/GDP/雇用統計も同様に系統的な 1 日ズレが連鎖していたため
  // PFEI（Principal Federal Economic Indicators）2026 年版 PDF を一次ソースとして
  // data/us-macro-schedule/*.json に手転記し、TS ⊆ JSON で照合する。
  // ※ ISM 製造業/非製造業 PMI は ismworld.org が認証ウォール内のため対象外。
  const US_MACRO_KEYWORDS = [
    "米 CPI",
    "米 PPI",
    "米 雇用統計",
    "米 小売売上高",
    "米 PCE",
    "米 GDP 速報",
  ];
  const US_MACRO_SOURCES = [
    "data/us-macro-schedule/cpi.json",
    "data/us-macro-schedule/ppi.json",
    "data/us-macro-schedule/employment.json",
    "data/us-macro-schedule/retail-sales.json",
    "data/us-macro-schedule/pce.json",
    "data/us-macro-schedule/gdp.json",
  ];

  function loadUsMacroKeys(): Set<string> {
    const keys = new Set<string>();
    for (const relPath of US_MACRO_SOURCES) {
      const fullPath = join(REPO_ROOT, relPath);
      const data = JSON.parse(readFileSync(fullPath, "utf-8")) as {
        events: Array<{ publishDate: string; publishTime?: string; label: string }>;
      };
      for (const ev of data.events) {
        keys.add(`${ev.publishDate}|${ev.publishTime ?? ""}|${ev.label}`);
      }
    }
    return keys;
  }

  it("TS 米マクロ指標エントリは全て data/us-macro-schedule/*.json に存在する", () => {
    const officialKeys = loadUsMacroKeys();
    const tsTargets = ECONOMIC_EVENTS.filter((e) =>
      US_MACRO_KEYWORDS.some((kw) => e.name.includes(kw)),
    );
    expect(tsTargets.length).toBeGreaterThan(0);

    const missing = tsTargets.filter((e) => {
      const key = `${e.date}|${e.time ?? ""}|${e.name}`;
      return !officialKeys.has(key);
    });

    if (missing.length > 0) {
      const detail = missing.map(
        (e) => `${e.date} ${e.time ?? "(終日)"} ★${e.importance} ${e.name}`,
      );
      throw new Error(
        `公式日程 JSON に存在しない TS 米マクロ指標エントリが ${missing.length} 件あります（PFEI 公式と日付が一致しないか、JSON 側が未更新）:\n${detail.join("\n")}`,
      );
    }
    expect(missing).toEqual([]);
  });
});

describe("filterByCategory", () => {
  const mixed: EconomicEvent[] = [
    { date: "2026-05-11", country: "JP", name: "macro 既定", importance: 2 },
    { date: "2026-05-11", country: "US", name: "明示 macro", importance: 2, category: "macro" },
    { date: "2026-05-11", country: "US", name: "geopolitical", importance: 2, category: "geopolitical" },
    { date: "2026-05-11", country: "JP", name: "policy", importance: 2, category: "policy" },
    { date: "2026-05-11", country: "US", name: "centralbank", importance: 2, category: "centralbank" },
  ];

  it("categories 未指定なら全件返す", () => {
    expect(filterByCategory(mixed, undefined)).toHaveLength(5);
  });

  it("空配列なら全件返す", () => {
    expect(filterByCategory(mixed, [])).toHaveLength(5);
  });

  it("macro のみで category 未指定エントリも含める（後方互換）", () => {
    const result = filterByCategory(mixed, ["macro"]);
    expect(result.map((e) => e.name).sort()).toEqual(["macro 既定", "明示 macro"]);
  });

  it("geopolitical のみで他を除外", () => {
    const result = filterByCategory(mixed, ["geopolitical"]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("geopolitical");
  });

  it("centralbank のみで他を除外", () => {
    const result = filterByCategory(mixed, ["centralbank"]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("centralbank");
  });

  it("複数カテゴリ指定の OR フィルタ", () => {
    const result = filterByCategory(mixed, ["geopolitical", "policy"]);
    expect(result.map((e) => e.name).sort()).toEqual(["geopolitical", "policy"]);
  });
});

describe("中銀高官発言 (category: centralbank)", () => {
  const speeches = ECONOMIC_EVENTS.filter((e) => e.category === "centralbank");

  it("centralbank エントリが 1 件以上存在する", () => {
    expect(speeches.length).toBeGreaterThan(0);
  });

  it("全ての centralbank エントリは speaker / speakerRole / votingMember を持つ", () => {
    const offenders = speeches.filter(
      (e) =>
        !e.speaker ||
        !e.speakerRole ||
        typeof e.votingMember !== "boolean",
    );
    if (offenders.length > 0) {
      const detail = offenders.map((e) => `${e.date} ${e.name}`);
      throw new Error(
        `speaker / speakerRole / votingMember が欠けた centralbank エントリが ${offenders.length} 件あります:\n${detail.join("\n")}`,
      );
    }
    expect(offenders).toEqual([]);
  });

  it("getEventsForDate で発言イベントが取得でき votingMember が保持される", () => {
    // 2026-05-27 のローガン・ダラス連銀総裁発言（投票権あり）をシードとして検証。
    const events = getEventsForDate("2026-05-27");
    const logan = events.find((e) => e.speaker === "ローガン");
    expect(logan).toBeDefined();
    expect(logan?.category).toBe("centralbank");
    expect(logan?.votingMember).toBe(true);
    expect(logan?.speakerRole).toBe("ダラス連銀総裁");
  });
});
