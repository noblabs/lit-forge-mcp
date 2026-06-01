// 経済指標リリース予定 リアルタイム取得ツール（v0.11.0 新設、v0.12.0 で NY 連銀・FRB 追加、
// v0.14.0 で BLS（PFEI 経由）追加、v0.15.0 で DOL/ETA・S&P Global PMI 追加、
// v0.19.0 でセンサス局 Advance Economic Indicators 追加、v0.20.0 で ForexFactory ライブ
// アダプタを新設し JOLTS を追加 + S&P PMI 速報をライブ化 + ISM・消費者信頼感・ADP をライブ追加）。
//
// 役割分担:
//   - 本ツール: 公式機関のリリースカレンダーを取得し、収録漏れの無い「網羅性」を担保
//   - get_economic_events_today: 手動キュレーション（★★★ 中心・半年 1 回更新・verify 済み）
//   両者は補完関係。市況サマリーでは両方を併用するのが望ましい。
//
// 現行カバー範囲（v0.20.0）:
//   - BEA（米）: GDP / 個人所得・支出（PCE）/ 貿易収支 / 企業収益 — 公式 JSON
//   - NY 連銀（米）: 製造業景気指数（Empire State）— 公式 HTML
//   - FRB（米）: 鉱工業生産（G.17）— 公式 HTML
//   - BLS（米）: 雇用統計 / CPI / PPI — ホワイトハウス PFEI 公式スケジュール PDF
//     （BLS 公式の HTML/RSS は bot ブロックされるため PFEI 経由で取得。官製一次ソースのため据え置き）
//   - DOL/ETA（米）: 新規失業保険申請件数（週次・毎週木 08:30 ET）— 木曜計算 + 祝日補正
//   - ForexFactory（米・ライブ）: JOLTS 求人件数 / 製造業・サービス業 PMI 速報（flash）/
//     ISM 製造業・非製造業 / 消費者信頼感（CB・ミシガン大）/ ADP 雇用 — faireconomy 週次 XML を
//     ライブ取得。これらは PFEI に含まれず（JOLTS/PMI 速報）or 従来は手動キュレーションのみだった
//     ものを動的化したもの（将来分の手動追記が不要）。PFEI/DOL/BEA/センサス局が出す指標は
//     重複防止のためマップに入れない。FF は thisweek のみのため来週分は週替わり後に出る。
//   - センサス局（米）: 卸売在庫 / 小売在庫 / 財貿易収支 の速報（Advance Economic
//     Indicators Report, 月次・08:30 ET）— 公式 List View HTML をライブ取得（翌年分も自動）
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
        "現行カバーは US（BEA・NY 連銀・FRB・BLS〔PFEI〕・DOL/ETA・ForexFactory〔JOLTS/PMI速報/ISM/消費者信頼感/ADP〕・センサス局）と JP（内閣府・日銀）のみ",
    ),
};

export const getEconomicReleasePulseTool: LitForgeTool = {
  name: "get_economic_release_pulse",
  title: "経済指標リリース予定（公式機関カレンダー リアルタイム取得）",
  description:
    "**公式機関のリリースカレンダーを実取得**して、当日〜週内の経済指標発表予定を返すツール。" +
    "BEA（米経済分析局）・NY 連銀・FRB・センサス局・内閣府・日銀の公式日程を並列取得し、国・期間でフィルタして返します。" +
    "【get_economic_events_today との違い】" +
    "`get_economic_events_today` は運営者が一次ソースで裏取りした手動キュレーション（★★★ 中心、半年 1 回更新）で、" +
    "収録対象を絞っているため取りこぼす『網羅性の穴』があります。" +
    "本ツールは公式カレンダーを実取得することでその穴を埋める**補完ツール**です。市況サマリーでは両方を併用してください。" +
    "【現行カバー範囲（v0.20.0）】" +
    "BEA（米 GDP / 個人所得・支出〔PCE〕/ 貿易収支 / 企業収益）、NY 連銀（米 製造業景気指数 Empire State）、" +
    "FRB（米 鉱工業生産 G.17）、**BLS**（雇用統計・CPI・PPI — ホワイトハウス PFEI 公式スケジュール経由）、" +
    "**DOL/ETA**（米 新規失業保険申請件数 — 週次・毎週木 08:30 ET）、" +
    "**ForexFactory ライブ**（米 JOLTS 求人件数・製造業/サービス業 PMI 速報・ISM 製造業/非製造業・消費者信頼感〔CB/ミシガン大〕・ADP 雇用 — faireconomy 週次カレンダー XML をライブ取得。PFEI 非収録 or 従来手動のみだった指標を動的化）、" +
    "**センサス局**（米 卸売在庫・小売在庫・財貿易収支の速報 — Advance Economic Indicators Report, 月次 08:30 ET。公式 List View をライブ取得し翌年分も自動反映）、" +
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
