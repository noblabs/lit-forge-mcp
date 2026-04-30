// 当日 or 今週の経済イベント（FOMC・日銀・雇用統計・CPI 等）を返す。
// データは自前ハードコード（economic-events.ts、半年分）。

import { z } from "zod";
import {
  COUNTRY_LABEL,
  IMPORTANCE_STARS,
  LAST_UPDATED,
  filterByImportance,
  getEventsForDate,
  getEventsForWeek,
  jstDateKey,
} from "../lib/economic-events.js";
import { jsonReply, type LitForgeTool } from "./types.js";

const inputSchema = {
  range: z
    .enum(["today", "week"])
    .optional()
    .describe("期間: today=本日のみ / week=今日含む 7 日間。既定 today"),
  minImportance: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .optional()
    .describe("最低重要度フィルタ: 1=★以上 / 2=★★以上 / 3=★★★のみ。既定 1"),
};

export const getEconomicEventsTodayTool: LitForgeTool = {
  name: "get_economic_events_today",
  title: "本日・今週の経済イベント",
  description:
    "本日（または今週）の主要経済イベント（FOMC・日銀金融政策決定会合・米雇用統計・CPI・GDP・中国 PMI など）を返します。データは lit-forge 運営者が手動キュレーションした半年分のスケジュール。",
  inputSchema,
  handler: ({ range, minImportance }) => {
    const today = jstDateKey();
    const events = range === "week" ? getEventsForWeek(today) : getEventsForDate(today);
    const filtered = filterByImportance(events, minImportance ?? 1);
    return jsonReply({
      today,
      range: range ?? "today",
      lastUpdated: LAST_UPDATED,
      count: filtered.length,
      events: filtered.map((e) => ({
        date: e.date,
        time: e.time ?? "終日",
        country: COUNTRY_LABEL[e.country],
        name: e.name,
        importance: IMPORTANCE_STARS[e.importance],
        note: e.note,
      })),
      note:
        "経済イベントは半年に 1 回手動更新。急な発表変更や中銀緊急会合は反映されない場合があります。",
    });
  },
};
