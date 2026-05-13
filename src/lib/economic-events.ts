// 主要経済イベントカレンダー（2026 年 5 月〜10 月）。
// FOMC・日銀会合・米雇用統計・CPI・GDP・中国 PMI などのマクロ指標に加え、
// v0.7.0 から要人訪問・首脳会談などの地政学イベント（category: "geopolitical"）も収録。
// 第三者 API に依存しない自前データ → AdSense YMYL 配慮 + スクレイピング先 DOM 変更で死なない。
// 半年に 1 回 PR で追加運用、`scripts/check-events-freshness.mjs` で 90 日前から CI 警告。
//
// 重要度: 1=★（参考）/ 2=★★（重要）/ 3=★★★（必読）。
// 日付は JST、時刻が示す場合は HH:MM JST。終日イベント（FOMC 結果等）は time 省略。
// 複数日にまたがるイベント（訪日・サミット等）は endDate を付与。

import type { EconomicEvent, EventCategory } from "./market-types.js";

export const LAST_UPDATED = "2026-05-12";

export const ECONOMIC_EVENTS: readonly EconomicEvent[] = [
  // ============ 2026 年 5 月 ============
  { date: "2026-05-01", time: "10:30", country: "CN", name: "中国 製造業 PMI（4 月）", importance: 2 },
  { date: "2026-05-01", time: "23:00", country: "US", name: "米 ISM 製造業 PMI（4 月）", importance: 3 },
  { date: "2026-05-08", time: "21:30", country: "US", name: "米 雇用統計（4 月）", importance: 3, note: "非農業部門雇用者数・失業率・平均時給" },
  { date: "2026-05-05", time: "23:00", country: "US", name: "米 ISM 非製造業 PMI（4 月）", importance: 2 },
  { date: "2026-05-12", time: "08:50", country: "JP", name: "日銀 主な意見（4 月会合分）", importance: 2, note: "4 月 27-28 日会合分。公表は会合の約 2 週間後" },
  // v0.7.0 で追加したベッセント訪日エントリは v0.8.0 で GEOPOLITICAL_EVENTS に移行。
  // 地政学イベントは get_geopolitical_calendar（確定スケジュール）/ get_geopolitical_pulse（速報）ツール経由で取得する。
  { date: "2026-05-12", time: "21:30", country: "US", name: "米 CPI（4 月）", importance: 3, note: "総合・コア前年比" },
  { date: "2026-05-13", time: "21:30", country: "US", name: "米 PPI（4 月）", importance: 2 },
  { date: "2026-05-14", time: "21:30", country: "US", name: "米 小売売上高（4 月）", importance: 2 },
  { date: "2026-05-15", country: "JP", name: "日 GDP 一次速報（1-3 月期）", importance: 3 },
  { date: "2026-05-22", time: "08:30", country: "JP", name: "日 CPI（4 月）", importance: 2 },
  { date: "2026-05-28", time: "21:30", country: "US", name: "米 PCE 価格指数（4 月）", importance: 3, note: "FRB が重視するインフレ指標" },

  // ============ 2026 年 6 月 ============
  { date: "2026-06-01", time: "10:30", country: "CN", name: "中国 製造業 PMI（5 月）", importance: 2 },
  { date: "2026-06-01", time: "23:00", country: "US", name: "米 ISM 製造業 PMI（5 月）", importance: 3 },
  { date: "2026-06-03", time: "23:00", country: "US", name: "米 ISM 非製造業 PMI（5 月）", importance: 2 },
  { date: "2026-06-05", time: "21:30", country: "US", name: "米 雇用統計（5 月）", importance: 3 },
  { date: "2026-06-10", time: "21:30", country: "US", name: "米 CPI（5 月）", importance: 3 },
  { date: "2026-06-11", time: "21:30", country: "US", name: "米 PPI（5 月）", importance: 2 },
  { date: "2026-06-12", country: "JP", name: "日 SQ（先物・オプション特別清算指数）", importance: 1 },
  { date: "2026-06-15", country: "JP", name: "日銀 金融政策決定会合（1 日目）", importance: 3 },
  { date: "2026-06-16", country: "JP", name: "日銀 金融政策決定会合（結果発表）", importance: 3, note: "総裁会見あり" },
  { date: "2026-06-16", country: "US", name: "FOMC（1 日目）", importance: 3 },
  { date: "2026-06-17", time: "27:00", country: "US", name: "FOMC 結果発表 + 経済予測", importance: 3, note: "ドットチャート更新月" },
  { date: "2026-06-17", time: "27:30", country: "US", name: "FRB 議長記者会見", importance: 3 },
  { date: "2026-06-25", time: "21:30", country: "US", name: "米 PCE 価格指数（5 月）", importance: 3 },

  // ============ 2026 年 7 月 ============
  { date: "2026-07-01", time: "10:30", country: "CN", name: "中国 製造業 PMI（6 月）", importance: 2 },
  { date: "2026-07-01", time: "23:00", country: "US", name: "米 ISM 製造業 PMI（6 月）", importance: 3 },
  { date: "2026-07-01", time: "08:50", country: "JP", name: "日銀短観（4-6 月期）", importance: 3, note: "大企業製造業 DI 等" },
  { date: "2026-07-03", time: "23:00", country: "US", name: "米 ISM 非製造業 PMI（6 月）", importance: 2 },
  { date: "2026-07-03", country: "US", name: "米 独立記念日 振替休場（7/4 土曜のため 7/3 金曜が休場）", importance: 1 },
  { date: "2026-07-02", time: "21:30", country: "US", name: "米 雇用統計（6 月）", importance: 3, note: "独立記念日 7/4 のため通常の金曜から木曜へ前倒し発表" },
  { date: "2026-07-10", country: "JP", name: "日 SQ", importance: 1 },
  { date: "2026-07-14", time: "21:30", country: "US", name: "米 CPI（6 月）", importance: 3 },
  { date: "2026-07-15", time: "11:00", country: "CN", name: "中国 GDP（4-6 月期）", importance: 3 },
  { date: "2026-07-15", time: "21:30", country: "US", name: "米 PPI（6 月）", importance: 2 },
  { date: "2026-07-16", time: "21:30", country: "US", name: "米 小売売上高（6 月）", importance: 2 },
  { date: "2026-07-30", country: "JP", name: "日銀 金融政策決定会合（1 日目）", importance: 3 },
  { date: "2026-07-31", country: "JP", name: "日銀 金融政策決定会合（結果 + 展望レポート）", importance: 3, note: "総裁会見あり" },
  { date: "2026-07-28", country: "US", name: "FOMC（1 日目）", importance: 3 },
  { date: "2026-07-29", time: "27:00", country: "US", name: "FOMC 結果発表", importance: 3 },
  { date: "2026-07-30", time: "21:30", country: "US", name: "米 GDP 速報値（4-6 月期）", importance: 3 },
  { date: "2026-07-30", time: "21:30", country: "US", name: "米 PCE 価格指数（6 月）", importance: 3 },

  // ============ 2026 年 8 月 ============
  { date: "2026-07-31", time: "10:30", country: "CN", name: "中国 製造業 PMI（7 月）", importance: 2 },
  { date: "2026-08-03", time: "23:00", country: "US", name: "米 ISM 製造業 PMI（7 月）", importance: 3 },
  { date: "2026-08-05", time: "23:00", country: "US", name: "米 ISM 非製造業 PMI（7 月）", importance: 2 },
  { date: "2026-08-07", time: "21:30", country: "US", name: "米 雇用統計（7 月）", importance: 3 },
  { date: "2026-08-12", time: "21:30", country: "US", name: "米 CPI（7 月）", importance: 3 },
  { date: "2026-08-13", time: "21:30", country: "US", name: "米 PPI（7 月）", importance: 2 },
  { date: "2026-08-14", time: "21:30", country: "US", name: "米 小売売上高（7 月）", importance: 2 },
  { date: "2026-08-14", country: "JP", name: "日 SQ", importance: 1 },
  { date: "2026-08-17", time: "08:50", country: "JP", name: "日 GDP 一次速報（4-6 月期）", importance: 3 },
  { date: "2026-08-21", time: "08:30", country: "JP", name: "日 CPI（7 月）", importance: 2 },
  { date: "2026-08-27", endDate: "2026-08-29", country: "US", name: "ジャクソンホール会議（〜29）", importance: 3, category: "macro", note: "FRB 議長講演に注目。FRB 主催の経済政策シンポジウムでありマクロ寄りのため category: macro" },
  { date: "2026-08-26", time: "21:30", country: "US", name: "米 PCE 価格指数（7 月）", importance: 3 },

  // ============ 2026 年 9 月 ============
  { date: "2026-09-01", time: "10:30", country: "CN", name: "中国 製造業 PMI（8 月）", importance: 2 },
  { date: "2026-09-01", time: "23:00", country: "US", name: "米 ISM 製造業 PMI（8 月）", importance: 3 },
  { date: "2026-09-03", time: "23:00", country: "US", name: "米 ISM 非製造業 PMI（8 月）", importance: 2 },
  { date: "2026-09-04", time: "21:30", country: "US", name: "米 雇用統計（8 月）", importance: 3 },
  { date: "2026-09-10", time: "21:30", country: "US", name: "米 PPI（8 月）", importance: 2 },
  { date: "2026-09-11", time: "21:30", country: "US", name: "米 CPI（8 月）", importance: 3 },
  { date: "2026-09-11", country: "JP", name: "日 SQ", importance: 1 },
  { date: "2026-09-15", country: "US", name: "FOMC（1 日目）", importance: 3 },
  { date: "2026-09-16", time: "27:00", country: "US", name: "FOMC 結果発表 + 経済予測", importance: 3, note: "ドットチャート更新月" },
  { date: "2026-09-17", country: "JP", name: "日銀 金融政策決定会合（1 日目）", importance: 3 },
  { date: "2026-09-18", country: "JP", name: "日銀 金融政策決定会合（結果発表）", importance: 3, note: "総裁会見あり" },
  { date: "2026-09-25", time: "08:30", country: "JP", name: "日 CPI（8 月）", importance: 2 },
  { date: "2026-09-30", time: "21:30", country: "US", name: "米 PCE 価格指数（8 月）", importance: 3 },

  // ============ 2026 年 10 月 ============
  { date: "2026-10-01", time: "08:50", country: "JP", name: "日銀短観（7-9 月期）", importance: 3 },
  { date: "2026-10-01", time: "10:30", country: "CN", name: "中国 製造業 PMI（9 月）", importance: 2 },
  { date: "2026-10-01", time: "23:00", country: "US", name: "米 ISM 製造業 PMI（9 月）", importance: 3 },
  { date: "2026-10-02", time: "23:00", country: "US", name: "米 ISM 非製造業 PMI（9 月）", importance: 2 },
  { date: "2026-10-02", time: "21:30", country: "US", name: "米 雇用統計（9 月）", importance: 3 },
  { date: "2026-10-09", country: "JP", name: "日 SQ", importance: 1 },
  { date: "2026-10-14", time: "21:30", country: "US", name: "米 CPI（9 月）", importance: 3 },
  { date: "2026-10-15", time: "21:30", country: "US", name: "米 PPI（9 月）", importance: 2 },
  { date: "2026-10-19", time: "11:00", country: "CN", name: "中国 GDP（7-9 月期）", importance: 3 },
  { date: "2026-10-27", country: "US", name: "FOMC（1 日目）", importance: 3 },
  { date: "2026-10-28", time: "27:00", country: "US", name: "FOMC 結果発表", importance: 3 },
  { date: "2026-10-29", country: "JP", name: "日銀 金融政策決定会合（1 日目）", importance: 3 },
  { date: "2026-10-30", country: "JP", name: "日銀 金融政策決定会合（結果 + 展望レポート）", importance: 3, note: "総裁会見あり" },
  { date: "2026-10-29", time: "21:30", country: "US", name: "米 GDP 速報値（7-9 月期）", importance: 3 },
  { date: "2026-10-29", time: "21:30", country: "US", name: "米 PCE 価格指数（9 月）", importance: 3 },
];

// JST の年月日を yyyy-mm-dd 形式で返す（leaderboard/keys.ts と同一ロジック）。
export function jstDateKey(now: Date = new Date()): string {
  const jstMs = now.getTime() + 9 * 3600 * 1000;
  const d = new Date(jstMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// JST 当日のイベントを返す（重要度降順）。
// 期間イベント（endDate あり）は date <= 当日 <= endDate でヒットする。
export function getEventsForDate(
  date: string,
  events: readonly EconomicEvent[] = ECONOMIC_EVENTS,
): EconomicEvent[] {
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

// 当日を含む 7 日間（今日〜+6 日）のイベントを返す。
// 期間イベントは [event.date, event.endDate] と週レンジが 1 日でも重なれば含める。
export function getEventsForWeek(
  fromDate: string,
  events: readonly EconomicEvent[] = ECONOMIC_EVENTS,
): EconomicEvent[] {
  const start = new Date(fromDate + "T00:00:00+09:00");
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(jstDateKey(d));
  }
  const weekStart = dates[0];
  const weekEnd = dates[dates.length - 1];
  return events
    .filter((e) => {
      const end = e.endDate ?? e.date;
      // 区間 [e.date, end] と [weekStart, weekEnd] の重なり判定
      return e.date <= weekEnd && end >= weekStart;
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        b.importance - a.importance ||
        (a.time ?? "00:00").localeCompare(b.time ?? "00:00"),
    );
}

// 重要度フィルタ（最低重要度）。例: minImportance=2 で ★★ 以上のみ。
export function filterByImportance(
  events: readonly EconomicEvent[],
  minImportance: 1 | 2 | 3,
): EconomicEvent[] {
  return events.filter((e) => e.importance >= minImportance);
}

// カテゴリフィルタ。category 未指定エントリは "macro" 扱いで判定する。
// categories 未指定 or 空配列の場合はフィルタしない（全件返す）。
export function filterByCategory(
  events: readonly EconomicEvent[],
  categories: readonly EventCategory[] | undefined,
): EconomicEvent[] {
  if (!categories || categories.length === 0) return events.slice();
  const set = new Set(categories);
  return events.filter((e) => set.has(e.category ?? "macro"));
}

export const COUNTRY_LABEL: Record<EconomicEvent["country"], string> = {
  JP: "🇯🇵 日本",
  US: "🇺🇸 米国",
  CN: "🇨🇳 中国",
  EU: "🇪🇺 欧州",
  GB: "🇬🇧 英国",
  OTHER: "🌏 その他",
};

export const IMPORTANCE_STARS: Record<EconomicEvent["importance"], string> = {
  1: "★",
  2: "★★",
  3: "★★★",
};
