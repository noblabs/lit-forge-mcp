// 経済指標リリース予定 リアルタイム取得ツール（v0.11.0 新設、v0.12.0 で NY 連銀・FRB 追加、v0.14.0 で BLS（PFEI 経由）追加）。
//
// 役割分担:
//   - 本ツール: 公式機関のリリースカレンダーを取得し、収録漏れの無い「網羅性」を担保
//   - get_economic_events_today: 手動キュレーション（★★★ 中心・半年 1 回更新・verify 済み）
//   両者は補完関係。市況サマリーでは両方を併用するのが望ましい。
//
// 現行カバー範囲（v0.14.0）:
//   - BEA（米）: GDP / 個人所得・支出（PCE）/ 貿易収支 / 企業収益 — 公式 JSON
//   - NY 連銀（米）: 製造業景気指数（Empire State）— 公式 HTML
//   - FRB（米）: 鉱工業生産（G.17）— 公式 HTML
//   - BLS（米）: 雇用統計 / CPI / PPI — ホワイトハウス PFEI 公式スケジュール PDF
//     （BLS 公式の HTML/RSS は bot ブロックされるため PFEI 経由で取得）
//   - 内閣府（日）: 四半期別 GDP 速報 — 公式 HTML
//   - 日銀（日）: 金融政策決定会合 / 主な意見 / 短観 / 議事要旨 — lit-forge 収録データ再利用
// 次サイクル予定: 総務省統計局（日 CPI）/ FOMC。

import { z } from "zod";
import {
  fetchEconomicReleasePulse,
  type ReleaseRange,
} from "../lib/economic-release-pulse/pulse.js";
import type { ReleaseCountry } from "../lib/economic-release-pulse/types.js";
import { jsonReply, type LitForgeTool } from "./types.js";

const inputSchema = {
  range: z
    .enum(["today", "week"])
    .optional()
    .describe("today=本日のみ / week=今日含む 7 日間。既定 today"),
  country: z
    .enum(["US", "JP", "EU", "GB", "CN"])
    .optional()
    .describe(
      "国コード絞り込み: US=米国 / JP=日本 / EU / GB / CN。未指定で全件。" +
        "現行カバーは US（BEA・NY 連銀・FRB）と JP（内閣府・日銀）のみ",
    ),
};

export const getEconomicReleasePulseTool: LitForgeTool = {
  name: "get_economic_release_pulse",
  title: "経済指標リリース予定（公式機関カレンダー リアルタイム取得）",
  description:
    "**公式機関のリリースカレンダーを実取得**して、当日〜週内の経済指標発表予定を返すツール。" +
    "BEA（米経済分析局）・NY 連銀・FRB・内閣府・日銀の公式日程を並列取得し、国・期間でフィルタして返します。" +
    "【get_economic_events_today との違い】" +
    "`get_economic_events_today` は運営者が一次ソースで裏取りした手動キュレーション（★★★ 中心、半年 1 回更新）で、" +
    "収録対象を絞っているため取りこぼす『網羅性の穴』があります。" +
    "本ツールは公式カレンダーを実取得することでその穴を埋める**補完ツール**です。市況サマリーでは両方を併用してください。" +
    "【現行カバー範囲（v0.14.0）】" +
    "BEA（米 GDP / 個人所得・支出〔PCE〕/ 貿易収支 / 企業収益）、NY 連銀（米 製造業景気指数 Empire State）、" +
    "FRB（米 鉱工業生産 G.17）、**BLS**（雇用統計・CPI・PPI — ホワイトハウス PFEI 公式スケジュール経由）、" +
    "内閣府（四半期別 GDP 速報）、日銀（金融政策決定会合 / 主な意見 / 短観 / 議事要旨）。" +
    "総務省統計局（日 CPI）・FOMC は次サイクルで追加予定で、現時点では本ツールに含まれません。" +
    "【利用上の注意】" +
    "アダプタ単位の取得失敗は sources 配列に error として記録され、他アダプタの結果は返されます（部分成功）。" +
    "結果は 6 時間キャッシュされます。各イベントには一次ソース URL（sourceUrl）が付きます。",
  inputSchema,
  handler: async ({ range, country }) => {
    const effectiveRange = (range ?? "today") as ReleaseRange;
    const result = await fetchEconomicReleasePulse({
      range: effectiveRange,
      country: country as ReleaseCountry | undefined,
    });
    return jsonReply({
      today: result.today,
      range: result.range,
      fetchedAt: result.fetchedAt,
      count: result.events.length,
      events: result.events,
      sources: result.sources,
      note:
        "公式機関のリリースカレンダーを実取得した結果です。手動キュレーションの " +
        "`get_economic_events_today` を補完します（網羅性担保が目的）。" +
        "アダプタ単位の失敗は sources[].error を参照してください。",
    });
  },
};
