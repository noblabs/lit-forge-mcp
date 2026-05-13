// 地政学リアルタイム速報ツール（v0.9.0 新設）。
// 設計詳細は docs/geopolitical-realtime.md 参照。
//
// 役割分担:
//   - 本ツール: 主要通信社の RSS を集約し、客観的なメタデータ（タイトル・配信元・配信日時・URL）を返す
//   - 解釈: LLM 側の責務（marketImplications 等の主観判断はツールに含めない）
//   - get_geopolitical_calendar: 確定済み公式スケジュール（半年に 1 回 PR 更新の静的データ）

import { z } from "zod";
import {
  PULSE_TOPIC_LABEL,
  type PulseTopic,
  fetchPulse,
} from "../lib/geopolitical-pulse.js";
import { jsonReply, type LitForgeTool } from "./types.js";

const inputSchema = {
  topic: z
    .enum(["us-china", "middle-east", "ukraine", "japan", "global"])
    .optional()
    .describe(
      "トピック: us-china=米中（首脳会談・貿易・関税・台湾） / middle-east=中東（イラン・ホルムズ・イスラエル・ガザ） / ukraine=ウクライナ・ロシア（和平・侵攻・支援・制裁） / japan=日本外交 / global=地政学全般。既定 global",
    ),
  maxItems: z
    .number()
    .int()
    .min(5)
    .max(30)
    .optional()
    .describe("返す最大記事数。5-30、既定 15"),
  hoursBack: z
    .number()
    .int()
    .min(6)
    .max(48)
    .optional()
    .describe("これより古い記事は除外する時間ウィンドウ（時間）。6-48、既定 24"),
};

export const getGeopoliticalPulseTool: LitForgeTool = {
  name: "get_geopolitical_pulse",
  title: "地政学リアルタイム速報（主要通信社 RSS 集約）",
  description:
    "**今この瞬間の地政学情勢**を返すツール。BBC World・Al Jazeera・Google News（トピック検索）の RSS を並列取得し、dedupe + 配信日時降順で記事メタデータを返します。" +
    "用途: 進行中の地政学リスク（電撃首脳会談・紛争激化・制裁発動・封鎖シナリオ等）の把握。市況サマリーで『地政学イベント』を尋ねられたときは、確定済み公式日程の `get_geopolitical_calendar` と本ツールを併用してください。" +
    "【ツール設計上の重要事項】" +
    "返却される各記事は客観的メタデータ（タイトル・配信元・配信日時・URL・配信元の短い summary）のみで、market implications などの**主観的な解釈はツール側で付与しません**。市場への影響評価・解釈は呼び出し側 LLM の責務です。" +
    "客観性の根拠: 「主要通信社が編集判断のうえ配信した記事」のメタデータを基盤とすることで、データ収録者の主観バイアスを排除しています。" +
    "【利用上の注意】" +
    "通信社 RSS は通常 5-30 分以内に最新ニュースが反映されます。フィード単位での失敗は sources 配列に error として記載され、他フィードの結果は返されます（部分成功）。" +
    "情報源は英語フィードが中心です。日本固有の地政学情報は不足する可能性があります（v0.10 以降で日本語フィード追加検討）。",
  inputSchema,
  handler: async ({ topic, maxItems, hoursBack }) => {
    const effectiveTopic = (topic ?? "global") as PulseTopic;
    const effectiveMax = maxItems ?? 15;
    const effectiveHours = hoursBack ?? 24;

    const result = await fetchPulse({
      topic: effectiveTopic,
      maxItems: effectiveMax,
      hoursBack: effectiveHours,
    });

    return jsonReply({
      topic: result.topic,
      topicLabel: PULSE_TOPIC_LABEL[effectiveTopic],
      fetchedAt: result.fetchedAt,
      hoursBack: effectiveHours,
      maxItems: effectiveMax,
      truncated: result.truncated,
      count: result.articles.length,
      articles: result.articles,
      sources: result.sources,
      note:
        "RSS ベースの編集済みニュース見出し集約です。各記事の市場インプリケーションは付与していません（解釈は呼び出し側 LLM の責務）。" +
        " 確定済み公式日程（首脳会談・選挙・サミット等）は別ツール `get_geopolitical_calendar` を使用してください。",
    });
  },
};
