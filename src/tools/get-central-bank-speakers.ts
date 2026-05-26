// 中銀高官の発言・講演スケジュール（v0.18.0 新設、ライブ取得）。
// ForexFactory 無料カレンダー XML から「これから」の発言予定を取得し、
// 米 Fed は fomc-roster.ts で役職・投票権を補完して返す。
//
// 役割分担:
//   - 本ツール: フォワードな発言予定（発言者・国・日付・時刻・重要度・投票権）を客観メタで返す
//   - get_economic_events_today: 指標・金融政策会合（半年手動キュレ）。発言は扱わない
//   - 市場解釈は呼び出し側 LLM の責務

import { z } from "zod";
import {
  fetchCentralBankSpeakers,
  type SpeakerRange,
} from "../lib/central-bank-speakers.js";
import {
  FOMC_ROSTER_YEAR,
  FOMC_ROSTER_LAST_VERIFIED,
} from "../lib/fomc-roster.js";
import type { Country } from "../lib/market-types.js";
import { jsonReply, type LitForgeTool } from "./types.js";

const inputSchema = {
  range: z
    .enum(["today", "week"])
    .optional()
    .describe(
      "期間: today=本日のみ / week=今日含む 7 日間。既定 today。" +
        "『明日』『今週』『週末』など今日を超える時間軸を含むときは week を指定すること。",
    ),
  countries: z
    .array(z.enum(["US", "JP", "EU", "GB", "CN", "OTHER"]))
    .optional()
    .describe(
      "国で絞り込み: US=米 Fed / JP=日銀 / EU=ECB / GB=BOE / CN=中国 / OTHER=その他中銀（カナダ・豪・NZ・スイス等）。未指定で全件",
    ),
};

export const getCentralBankSpeakersTool: LitForgeTool = {
  name: "get_central_bank_speakers",
  title: "中銀高官の発言・講演スケジュール（ライブ取得）",
  description:
    "**これからの**中銀高官の発言・講演予定を返すツール。ForexFactory の無料カレンダーを取得し、発言系イベント（FRB 理事・地区連銀総裁・日銀・ECB・BOE 等）だけを日付昇順で返します。" +
    "米 Fed（FOMC）の発言者は当年の名簿で **role（ダラス連銀総裁等）と votingMember（投票権の有無）** を補完します。投票権ありの発言ほど政策の方向性を示唆しやすく市場インパクトが大きいため、重要度（importance）を引き上げています（議長=★★★ / 投票メンバー=★★以上）。" +
    "用途: 市況サマリーで『今日の要人発言』『今週の Fed スピーカー』を尋ねられたとき。指標・金融政策会合の予定は別ツール `get_economic_events_today` を使用してください（本ツールは“発言”専用）。" +
    "【利用上の注意】" +
    "第三者の無料フィード（faireconomy.media の ForexFactory 週次カレンダー）に依存します。フィード単位の失敗は sources 配列に error として記載し、取得できた分は返します（部分成功）。" +
    "カバー範囲は現 FF 週（月〜日）です。range=\"week\" が週末を跨いで翌週に及ぶ日は、その週が配信対象になるまで取得できない場合があります。" +
    "FF の発言予定は時刻・有無が直前に変わることがあります。返却メタは客観値のみで、市場解釈は付与しません（呼び出し側 LLM の責務）。" +
    `Fed 名簿は ${FOMC_ROSTER_YEAR} 年版（最終確認 ${FOMC_ROSTER_LAST_VERIFIED}）。投票権は毎年 1 月にローテーションします。`,
  inputSchema,
  handler: async ({ range, countries }) => {
    const effectiveRange = (range ?? "today") as SpeakerRange;
    const result = await fetchCentralBankSpeakers({
      range: effectiveRange,
      countries: countries as Country[] | undefined,
    });
    return jsonReply({
      today: result.today,
      range: result.range,
      fetchedAt: result.fetchedAt,
      fetchOk: result.fetchOk,
      fomcRosterYear: FOMC_ROSTER_YEAR,
      fomcRosterLastVerified: FOMC_ROSTER_LAST_VERIFIED,
      count: result.speakers.length,
      speakers: result.speakers,
      sources: result.sources,
      note: result.fetchOk
        ? "ForexFactory 無料カレンダー由来のフォワードな発言予定です。米 Fed の役職・投票権は当年 FOMC 名簿で補完（毎年 1 月ローテーション・要更新）。" +
          " 指標・金融政策会合は get_economic_events_today を併用してください。市場インプリケーションは付与していません（解釈は呼び出し側 LLM の責務）。"
        : "⚠️ フィード取得に失敗しました（sources の error 参照。例: HTTP 429 レート制限）。これは『発言予定なし』ではなく『取得できなかった』状態です。count:0 を予定ゼロと解釈しないでください。時間をおいて再試行してください。",
    });
  },
};
