// 日銀アダプタ。
// 日銀の金融政策決定会合・主な意見・短観・議事要旨は、既に economic-events.ts に
// 手動キュレーション＋verify:cb で裏取り済みのデータがある。それを再利用し、
// pulse ツールの出力にも JP の中銀イベントが含まれるようにする
// （新規スクレイピングはせず、verify 済みデータの再エクスポートに留める）。

import { ECONOMIC_EVENTS } from "../../economic-events.js";
import type { ReleaseAdapter, ReleaseEvent } from "../types.js";

const BOJ_SOURCE_URL = "https://www.boj.or.jp/about/calendar/index.htm";

export const bojAdapter: ReleaseAdapter = {
  key: "boj",
  label: "日銀（金融政策決定会合・主な意見・短観・議事要旨）",
  // ネットワーク不要・同期だが、ReleaseAdapter 契約に合わせ async で返す。
  fetchEvents: async (): Promise<ReleaseEvent[]> =>
    ECONOMIC_EVENTS.filter(
      (e) => e.country === "JP" && e.name.startsWith("日銀"),
    ).map((e) => ({
      date: e.date,
      ...(e.time ? { time: e.time } : {}),
      country: "JP" as const,
      name: e.name,
      source: "日銀（lit-forge 収録データ）",
      sourceUrl: BOJ_SOURCE_URL,
    })),
};
