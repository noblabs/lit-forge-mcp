// 当日 or 今週の経済イベント（FOMC・日銀・雇用統計・CPI 等）を返す。
// v0.7.0 から要人訪問・首脳会談などの地政学イベントも含む（category で絞り込み可能）。
// データは自前ハードコード（economic-events.ts、半年分）。

import { z } from "zod";
import {
  COUNTRY_LABEL,
  IMPORTANCE_STARS,
  LAST_UPDATED,
  filterByCategory,
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
    .describe(
      "期間: today=本日のみ / week=今日含む 7 日間。既定 today。" +
        "翌日以降のイベント（『明日』『今週』『週末』『次の指標』等）を含めて答える必要があるときは必ず week を指定すること。",
    ),
  minImportance: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .optional()
    .describe("最低重要度フィルタ: 1=★以上 / 2=★★以上 / 3=★★★のみ。既定 1"),
  category: z
    .array(z.enum(["macro", "geopolitical", "policy", "centralbank"]))
    .optional()
    .describe(
      "カテゴリ絞り込み: macro=マクロ経済指標 / geopolitical=要人訪問・首脳会談 / policy=選挙・予算・サミット / centralbank=中銀高官の発言・講演（FRB 理事・地区連銀総裁・日銀審議委員・ECB 専務理事等）。未指定で全カテゴリ",
    ),
};

export const getEconomicEventsTodayTool: LitForgeTool = {
  name: "get_economic_events_today",
  title: "本日・今週の経済イベント",
  description:
    "本日（または今週）の主要経済イベント（FOMC・日銀金融政策決定会合・米雇用統計・CPI・GDP・中国 PMI などのマクロ指標、および FRB 理事・地区連銀総裁・日銀審議委員・ECB 専務理事などの中銀高官発言）を返します。発言イベントは category=\"centralbank\" で、speaker / speakerRole / votingMember（当該会合での投票権の有無）付き。期間イベント（ジャクソンホール会議等）は期間中の各日に today クエリでヒットします。データは lit-forge 運営者が手動キュレーションした半年分のスケジュール。" +
    "【利用上の注意】既定 range=today は当日分のみを返すため、ユーザーの質問が『明日』『今週』『週末』『次の指標』など今日を超える時間軸を含むときは range=\"week\" を明示すること。直前に today で取得済みでも、未来の時間軸が話題に出た時点で week で取り直す。" +
    "【v0.9.0 以降】首脳会談・要人訪問・国際サミット・主要国選挙・地政学リスクの 4 サブカテゴリは `get_geopolitical_calendar`（確定スケジュール）に、進行中の地政学情勢は `get_geopolitical_pulse`（リアルタイム速報）に分離されました。地政学情報が必要なときはそれらを使用してください。本ツールの category=\"geopolitical\" 引数は後方互換のため残されていますが、結果は空に近くなります。",
  inputSchema,
  handler: ({ range, minImportance, category }) => {
    const today = jstDateKey();
    const events = range === "week" ? getEventsForWeek(today) : getEventsForDate(today);
    const byImportance = filterByImportance(events, minImportance ?? 1);
    const filtered = filterByCategory(byImportance, category);
    const requestedGeopolitical = category?.includes("geopolitical") ?? false;
    return jsonReply({
      today,
      range: range ?? "today",
      lastUpdated: LAST_UPDATED,
      count: filtered.length,
      events: filtered.map((e) => ({
        date: e.date,
        endDate: e.endDate,
        time: e.time ?? "終日",
        country: COUNTRY_LABEL[e.country],
        name: e.name,
        importance: IMPORTANCE_STARS[e.importance],
        category: e.category ?? "macro",
        // 中銀高官発言（centralbank）固有メタ。それ以外のイベントでは undefined を返さず欄ごと省く。
        ...(e.speaker !== undefined ? { speaker: e.speaker } : {}),
        ...(e.speakerRole !== undefined ? { speakerRole: e.speakerRole } : {}),
        ...(e.votingMember !== undefined
          ? {
              votingMember: e.votingMember,
              votingStatus: e.votingMember ? "投票権あり" : "投票権なし",
            }
          : {}),
        note: e.note,
      })),
      note:
        "経済イベントは半年に 1 回手動更新。急な発表変更や中銀緊急会合は反映されない場合があります。" +
        (requestedGeopolitical
          ? " ※ 地政学イベントは v0.9.0 で `get_geopolitical_calendar`（確定スケジュール）+ `get_geopolitical_pulse`（リアルタイム速報）に分離されました。詳細はそちらをご利用ください。"
          : ""),
    });
  },
};
