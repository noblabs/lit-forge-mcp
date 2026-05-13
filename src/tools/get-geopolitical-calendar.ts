// 地政学カレンダー（v0.9.0 で get_geopolitical_events からリネーム）。
// **確定済み公式スケジュール専用**: 首脳会談・国際サミット・主要国選挙・公式リスク日程（制裁発動・条約期限など）。
// 進行中の地政学リスクや突発イベントは別ツール get_geopolitical_pulse で取得すること。
//
// データは手動キュレーション JSON（半年に 1 回 PR 更新）。
// 中立性ガイドライン: 確定済み公式日程のみ収録し、主観判断を要するイベント（紛争激化等）は登録しない。

import { z } from "zod";
import { COUNTRY_LABEL, jstDateKey } from "../lib/economic-events.js";
import {
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

export const getGeopoliticalCalendarTool: LitForgeTool = {
  name: "get_geopolitical_calendar",
  title: "地政学カレンダー（確定済み公式スケジュール: 首脳会談・サミット・選挙・公式リスク日程）",
  description:
    "**確定済み公式スケジュール専用**ツール。首脳会談・要人訪問（bilateral）、G7/G20/IMF/APEC/BRICS/NATO 等の国際サミット（summit）、主要国の国政選挙（election）、公式の地政学リスク日程（制裁発動・条約期限など、risk）の 4 サブカテゴリを返します。各イベントには market implications（為替・株・債券・コモディティへの注目点）、参加者、一次ソース URL が付与されます。" +
    "データは lit-forge 運営者が一次ソース（日本政府公式・国際機関公式・民間集計）から手動キュレーション。**半年に 1 回 PR 更新の静的データ**で、確定済み公式日程のみを収録します（主観判断要件のイベントは登録しない方針）。" +
    "【重要】このツールは『カレンダー』であり、**進行中の地政学リスク（紛争激化・電撃会談・突発的な制裁・封鎖シナリオなど）を取りこぼします**。今この瞬間の地政学情勢を知りたいときは別ツール `get_geopolitical_pulse` を使ってください。" +
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
        "確定済み公式日程のみのカレンダーです。半年に 1 回 PR で更新するため、突発イベント（電撃会談・紛争激化・即時制裁など）は反映されません。リアルタイム情勢は get_geopolitical_pulse を併用してください。",
    });
  },
};
