// S&P Global 米 PMI 速報（flash）アダプタ（v0.15.0 新設）。
//
// 製造業・サービス業の flash PMI 発表予定を返す。S&P Global は民間データ会社で
// 官公庁カレンダー実取得の対象外だったため pulse の網羅性の穴になっていた。
// PFEI アダプタと同様、スクレイピングせず静的キュレ済みデータ
// (src/lib/sp-global-pmi-schedule-data.ts) を ReleaseEvent[] に展開する。
// HTTP fetch を行わないためキャッシュ不要・常に成功扱い。

import type { ReleaseAdapter, ReleaseEvent } from "../types.js";
import { etToJst } from "../util.js";
import { SP_GLOBAL_PMI_SCHEDULE } from "../../sp-global-pmi-schedule-data.js";

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// flash 発表 1 件を「製造業速報」「サービス業速報」の 2 イベントに展開する。
// 注: S&P Global の "Services" は ISM の「非製造業」とは別系列。混同回避のため
//     サービス業表記にする。総合（Composite）速報は需要を見て後追加。
const PMI_NAMES = ["米 製造業PMI（速報）", "米 サービス業PMI（速報）"] as const;

// 静的スケジュールを ReleaseEvent[] に展開する純関数（テスト用 export）。
export function spGlobalPmiToReleaseEvents(): ReleaseEvent[] {
  const out: ReleaseEvent[] = [];
  const { flashReleases, releaseTimeEt, sourceUrl } = SP_GLOBAL_PMI_SCHEDULE;
  for (const r of flashReleases) {
    const { date, time } = etToJst(ymd(r.year, r.month, r.day), releaseTimeEt);
    for (const name of PMI_NAMES) {
      out.push({
        date,
        time,
        country: "US",
        name,
        source: "S&P Global",
        sourceUrl,
      });
    }
  }
  return out;
}

export const spGlobalPmiAdapter: ReleaseAdapter = {
  key: "sp-global-pmi",
  label: "S&P Global（米 製造業/サービス業 PMI 速報）",
  fetchEvents: async () => spGlobalPmiToReleaseEvents(),
};
