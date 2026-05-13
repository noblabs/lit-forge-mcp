// 地政学イベントカレンダー（v0.8.0 新設）。
// 首脳会談・要人訪問・国際サミット・主要国選挙・確定済み地政学リスク日程を収録。
// 一次ソースは data/geopolitical-events/*.json（4 ファイル）で、verify:geopolitical で TS⊆JSON 突合する。
//
// データ追加・更新ルールは CONTRIBUTING.md「地政学イベントカレンダーの更新ルール」を参照。
// 中立性ガイドライン: 確定済み公式日程のみ収録し、主観判断を要するイベント（紛争激化等）は登録しない。

import type {
  Country,
  GeopoliticalEvent,
  GeopoliticalSourceTier,
  GeopoliticalSubcategory,
} from "./market-types.js";
import { jstDateKey } from "./economic-events.js";

export const LAST_UPDATED_GEOPOLITICAL = "2026-05-13";

export const GEOPOLITICAL_EVENTS: readonly GeopoliticalEvent[] = [
  {
    id: "bilateral-bessent-jp-visit-2026-05",
    date: "2026-05-11",
    endDate: "2026-05-13",
    country: "US",
    name: "ベッセント米財務長官 訪日（〜5/13）",
    subcategory: "bilateral",
    importance: 2,
    participants: ["米国（ベッセント財務長官）", "日本"],
    marketImplications: {
      fx: "ドル円・日米財務対話の有無に注目。関税協議の文脈も含む",
    },
    source: "official-jp",
    sourceUrl: "https://www.mofa.go.jp/mofaj/area/usa/index.html",
    lastVerifiedAt: "2026-05-13",
    note: "為替・関税協議の文脈。日米財務対話の有無に注目",
  },
];

// 当日のイベントを返す（重要度降順）。期間イベントは date <= 当日 <= endDate でヒット。
export function getGeopoliticalEventsForDate(
  date: string,
  events: readonly GeopoliticalEvent[] = GEOPOLITICAL_EVENTS,
): GeopoliticalEvent[] {
  return events
    .filter((e) => {
      const end = e.endDate ?? e.date;
      return e.date <= date && date <= end;
    })
    .sort(
      (a, b) =>
        b.importance - a.importance ||
        (a.time ?? "00:00").localeCompare(b.time ?? "00:00"),
    );
}

// 当日含む 7 日間のイベントを返す。期間イベントは週レンジと 1 日でも重なれば含める。
export function getGeopoliticalEventsForWeek(
  fromDate: string,
  events: readonly GeopoliticalEvent[] = GEOPOLITICAL_EVENTS,
): GeopoliticalEvent[] {
  return getGeopoliticalEventsForRange(fromDate, 7, events);
}

// 当日含む 30 日間のイベントを返す。地政学は中期視点が要るため v0.8.0 で追加。
export function getGeopoliticalEventsForMonth(
  fromDate: string,
  events: readonly GeopoliticalEvent[] = GEOPOLITICAL_EVENTS,
): GeopoliticalEvent[] {
  return getGeopoliticalEventsForRange(fromDate, 30, events);
}

// 期間ヘルパー（week / month で共通化）。
function getGeopoliticalEventsForRange(
  fromDate: string,
  days: number,
  events: readonly GeopoliticalEvent[],
): GeopoliticalEvent[] {
  const start = new Date(fromDate + "T00:00:00+09:00");
  const endDate = new Date(start);
  endDate.setDate(endDate.getDate() + (days - 1));
  const rangeStart = jstDateKey(start);
  const rangeEnd = jstDateKey(endDate);
  return events
    .filter((e) => {
      const end = e.endDate ?? e.date;
      // 区間 [e.date, end] と [rangeStart, rangeEnd] の重なり判定
      return e.date <= rangeEnd && end >= rangeStart;
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        b.importance - a.importance ||
        (a.time ?? "00:00").localeCompare(b.time ?? "00:00"),
    );
}

// サブカテゴリフィルタ。subcategories 未指定 or 空配列の場合は全件返す。
export function filterBySubcategory(
  events: readonly GeopoliticalEvent[],
  subcategories: readonly GeopoliticalSubcategory[] | undefined,
): GeopoliticalEvent[] {
  if (!subcategories || subcategories.length === 0) return events.slice();
  const set = new Set(subcategories);
  return events.filter((e) => set.has(e.subcategory));
}

// 国フィルタ。countries 未指定 or 空配列の場合は全件返す。
export function filterByCountry(
  events: readonly GeopoliticalEvent[],
  countries: readonly Country[] | undefined,
): GeopoliticalEvent[] {
  if (!countries || countries.length === 0) return events.slice();
  const set = new Set(countries);
  return events.filter((e) => set.has(e.country));
}

// 重要度フィルタ（最低重要度）。
export function filterByImportanceGeo(
  events: readonly GeopoliticalEvent[],
  minImportance: 1 | 2 | 3,
): GeopoliticalEvent[] {
  return events.filter((e) => e.importance >= minImportance);
}

export const SUBCATEGORY_LABEL: Record<GeopoliticalSubcategory, string> = {
  summit: "🌐 国際サミット・国際会議",
  bilateral: "🤝 首脳会談・要人訪問",
  election: "🗳️ 主要国選挙",
  risk: "⚠️ 地政学リスク（確定日程）",
};

export const SOURCE_LABEL: Record<GeopoliticalSourceTier, string> = {
  "official-jp": "日本政府公式",
  "official-intl": "国際機関公式",
  private: "民間集計",
};
