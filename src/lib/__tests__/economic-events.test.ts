import { describe, expect, it } from "vitest";
import {
  ECONOMIC_EVENTS,
  getEventsForDate,
  getEventsForWeek,
  jstDateKey,
} from "../economic-events.js";

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
  it("全イベントは土日に登録されていない（市場休場の祝日エントリのみ例外）", () => {
    const offenders = ECONOMIC_EVENTS.filter((e) => {
      const dow = jstDayOfWeek(e.date);
      const isWeekend = dow === 0 || dow === 6;
      // 例外: 名前に「休場」を含む祝日エントリは固定日のため土日もあり得る
      // （例: 米独立記念日 7/4 が土曜の年など）
      const isMarketClosure = e.name.includes("休場");
      return isWeekend && !isMarketClosure;
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

  it("米 PCE 価格指数は金曜でなければならない", () => {
    const pce = ECONOMIC_EVENTS.filter(
      (e) => e.country === "US" && e.name.includes("PCE"),
    );
    expect(pce.length).toBeGreaterThan(0);
    const offenders = pce.filter((e) => jstDayOfWeek(e.date) !== 5);
    if (offenders.length > 0) {
      const detail = offenders.map((e) => `${e.date} ${e.name}`);
      throw new Error(
        `米 PCE が金曜以外に登録されています:\n${detail.join("\n")}`,
      );
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
    // 5/15 には ★3 (日 GDP) と ★2 (米 小売) の 2 件がある
    const events = getEventsForDate("2026-05-15");
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
