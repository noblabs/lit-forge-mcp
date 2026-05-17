// 米マクロ最新値取得ツール（v0.13.0 新設・v0.14.0 で 4→7 系列拡張）。
// 雇用統計・失業率・CPI・コア CPI・PPI・コア PPI・平均時給 の最新発表値 + 前月比 + 前年同月比
// を BLS Public Data API v2 から 1 リクエストで取得する。
//
// 設計背景:
//   - 当初は get_economic_release_pulse に BLS アダプタを追加して「発表予定日」を網羅する
//     計画だったが、BLS の HTML schedule ページと RSS は Akamai bot 管理で 403 が返り取得不能。
//   - 代替路として Public Data API v2 が無認証で動くことを実証し、本ツールでは「最新値」の
//     取得を実装することにした。発表予定の方は v0.14.0 で White House OMB/OIRA の
//     PFEI Schedule PDF を get_economic_release_pulse に統合する形で別系統で解決。
//   - 本ツールは get_market_snapshot（市況値）のマクロ指標版という位置づけ。

import { fetchUsMacroLatest } from "../lib/us-macro-latest.js";
import { jsonReply, errorReply, type LitForgeTool } from "./types.js";

const inputSchema = {};

export const getUsMacroLatestTool: LitForgeTool = {
  name: "get_us_macro_latest",
  title: "米マクロ最新値（雇用統計・失業率・CPI・PPI）",
  description:
    "**米マクロ三大指標**（雇用統計・CPI・PPI）+ コア指数 + 失業率 + 平均時給の最新発表値と前月比・前年同月比を返すツール。" +
    "BLS（米労働統計局）の Public Data API v2 を 1 リクエストで叩き、7 系列を集約して返します。" +
    "API key 不要・無認証で動作（BLS 公開 API、未登録枠の 1 日 25 リクエストで運用、6 時間キャッシュ込み）。" +
    "【取得系列（v0.14.0 で 4→7 系列に拡張）】" +
    "雇用統計 = 非農業部門就業者数（CES0000000001、千人）/ " +
    "失業率（LNS14000000、%）/ " +
    "CPI 都市部全消費者（CUUR0000SA0、index 1982-84=100）/ " +
    "**コア CPI**（食料・エネルギー除く、CUUR0000SA0L1E、index）/ " +
    "PPI 最終需要（WPSFD4、index 2009=100）/ " +
    "**コア PPI**（食料・エネルギー除く、WPSFD49104、index）/ " +
    "**平均時給**（民間部門季調済、CES0500000003、USD/hour）。" +
    "【返却内容】" +
    "各指標について最新月の値・前月差・前月比%・前年同月差・前年同月比% を返します。" +
    "速報値（preliminary）には preliminary=true が立ち、後日確定値に更新されます。" +
    "データ欠損月（政府閉鎖等で BLS が値を出せなかった月）は value=null。" +
    "【関連ツール】" +
    "発表予定日は別ツール `get_economic_release_pulse`（公式機関カレンダー）/ " +
    "`get_economic_events_today`（手動キュレ）を参照。本ツールは『今の指標値』、" +
    "それらは『次にいつ出るか』を答えます。" +
    "【利用上の注意】" +
    "BLS は HTML カレンダー / RSS への bot アクセスを拒否しており、" +
    "本ツールが扱う『最新値』のみが自動取得可能です。投資助言ではなく情報集約。",
  inputSchema,
  handler: async () => {
    try {
      const result = await fetchUsMacroLatest();
      return jsonReply({
        ...result,
        note:
          "BLS Public Data API v2 から取得。" +
          "発表予定日は get_economic_release_pulse / get_economic_events_today を併用してください。" +
          "preliminary=true の月は後日確定値に更新されます。投資助言ではありません。",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "fetch failed";
      return errorReply(`BLS Public Data API 取得失敗: ${msg}`);
    }
  },
};
