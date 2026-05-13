// 地政学イベント専用ツール（v0.8.0 新設）。
// 首脳会談・要人訪問・国際サミット・主要国選挙・確定済み地政学リスクを構造化して返す。
// 既存 get_economic_events_today の geopolitical カテゴリと並存（破壊的変更なし）し、
// 本ツールは marketImplications / participants / sourceUrl など地政学固有フィールドを伴う。

import { z } from "zod";
import { COUNTRY_LABEL, jstDateKey } from "../lib/economic-events.js";
import {
  GEOPOLITICAL_EVENTS,
  LAST_UPDATED_GEOPOLITICAL,
  SOURCE_LABEL,
  SUBCATEGORY_LABEL,
  filterByCountry,
  filterByImportanceGeo,
  filterBySubcategory,
  getGeopoliticalEventsForDate,
  getGeopoliticalEventsForMonth,
  getGeopoliticalEventsForWeek,
} from "../lib/geopolitical-events.js";
import { IMPORTANCE_STARS } from "../lib/economic-events.js";
import { jsonReply, type LitForgeTool } from "./types.js";

const inputSchema = {
  range: z
    .enum(["today", "week", "month"])
    .optional()
    .describe(
      "期間: today=本日のみ / week=今日含む 7 日間 / month=今日含む 30 日間。既定 week（地政学は中期視点が要るため）。",
    ),
  subcategory: z
    .array(z.enum(["summit", "bilateral", "election", "risk"]))
    .optional()
    .describe(
      "サブカテゴリ絞り込み: summit=国際サミット・国際会議 / bilateral=首脳会談・要人訪問 / election=主要国選挙 / risk=確定済み地政学リスク（制裁・条約期限等）。未指定で全件",
    ),
  country: z
    .array(z.enum(["JP", "US", "CN", "EU", "GB", "OTHER"]))
    .optional()
    .describe("国コード絞り込み: JP/US/CN/EU/GB/OTHER。複数指定可。未指定で全件"),
  minImportance: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .optional()
    .describe("最低重要度フィルタ: 1=★以上 / 2=★★以上 / 3=★★★のみ。既定 1"),
};

export const getGeopoliticalEventsTool: LitForgeTool = {
  name: "get_geopolitical_events",
  title: "地政学イベントカレンダー（首脳会談・サミット・選挙・リスク）",
  description:
    "本日・今週・今月の地政学イベントを返します。首脳会談・要人訪問（bilateral）、G7/G20/IMF/APEC/BRICS/NATO 等の国際サミット（summit）、主要国の国政選挙（election）、確定済み公式の地政学リスク日程（制裁発動・条約期限など、risk）の 4 サブカテゴリで整理されています。各イベントには市場へのインプリケーション（marketImplications: 為替・株・債券・コモディティへの注目点）、参加者（participants）、一次ソース URL（sourceUrl）が付与されます。" +
    "データは lit-forge 運営者が一次ソース（日本政府公式・国際機関公式・民間集計）から手動キュレーション。確定済み公式日程のみ収録し、主観判断を要するイベント（紛争激化等）は登録されません。" +
    "【利用上の注意】既定 range=week。さらに先まで見たい場合は range=\"month\" を指定。マクロ経済イベント（CPI・FOMC・日銀会合等）は別ツール `get_economic_events_today` を使用。",
  inputSchema,
  handler: ({ range, subcategory, country, minImportance }) => {
    const today = jstDateKey();
    const effectiveRange = range ?? "week";
    let events;
    if (effectiveRange === "today") {
      events = getGeopoliticalEventsForDate(today);
    } else if (effectiveRange === "month") {
      events = getGeopoliticalEventsForMonth(today);
    } else {
      events = getGeopoliticalEventsForWeek(today);
    }
    const byImportance = filterByImportanceGeo(events, minImportance ?? 1);
    const bySubcategory = filterBySubcategory(byImportance, subcategory);
    const filtered = filterByCountry(bySubcategory, country);

    return jsonReply({
      today,
      range: effectiveRange,
      lastUpdated: LAST_UPDATED_GEOPOLITICAL,
      count: filtered.length,
      events: filtered.map((e) => ({
        id: e.id,
        date: e.date,
        endDate: e.endDate,
        time: e.time ?? "終日",
        country: COUNTRY_LABEL[e.country],
        name: e.name,
        subcategory: SUBCATEGORY_LABEL[e.subcategory],
        importance: IMPORTANCE_STARS[e.importance],
        participants: e.participants,
        marketImplications: e.marketImplications,
        source: SOURCE_LABEL[e.source],
        sourceUrl: e.sourceUrl,
        lastVerifiedAt: e.lastVerifiedAt,
        note: e.note,
      })),
      note:
        "地政学イベントは確定済み公式日程のみ収録。半年に 1 回 PR で更新。急な日程変更や臨時会合は反映されない場合があります。",
    });
  },
};
