// 米センサス局 Advance Economic Indicators Report アダプタ（v0.19.0 新設・ライブ取得）。
//
// 毎月下旬 08:30 ET に公表される Advance Economic Indicators Report の発表予定を返す。
// 同報告は卸売在庫【速報】・小売在庫【速報】・財貿易収支【速報】の 3 系列を同時公表する。
// センサス局は release_pulse の既存アダプタ（BEA / NY 連銀 / FRB / BLS(PFEI) /
// DOL/ETA / ForexFactory / 内閣府 / 日銀）のいずれもカバーしておらず、
// 卸売在庫【速報値】が網羅性の穴になっていた（2026-05-29 取りこぼし）。
//
// 方式: BEA / NY 連銀 / FRB と同じ「公式カレンダーを毎回ライブ取得」。静的手転記は
//   翌年分を手で足さないと止まる（穴が再発する）ため不採用。本アダプタは
//   センサス局 公式リリースカレンダー（List View）の HTML を取得し、
//   「Advance Economic Indicators Report」行を抽出するので、翌年以降の日程も
//   公式ページが更新され次第そのまま反映される（手動更新ゼロ）。
//
//   一次ソース: https://www.census.gov/economic-indicators/calendar-listview.html
//   HTML 構造（安定）: 各 <tr> が 1 リリース。指標名は <a>...</a>、発表日時は
//     <td sorttable_customkey="YYYYMMDDHHMM"> に ET の 12 桁数値で埋め込まれている。
//     例: <a href="/econ/indicators/">Advance Economic Indicators Report (...)</a>
//         <td sorttable_customkey="202605290830">May 29, 2026</td>
//   依存追加を避けるため正規表現ベース（nyfed.ts / cao.ts と同方針）。

import type { ReleaseAdapter, ReleaseEvent } from "../types.js";
import { withCache, DEFAULT_CACHE_TTL_MS } from "../cache.js";
import {
  etToJst,
  RELEASE_PULSE_UA,
  RELEASE_PULSE_FETCH_TIMEOUT_MS,
} from "../util.js";

const CENSUS_URL =
  "https://www.census.gov/economic-indicators/calendar-listview.html";
const SOURCE_LABEL = "U.S. Census Bureau（Advance Economic Indicators Report）";

// Advance Economic Indicators Report が同時公表する速報系列の日本語名。
// 注: 同報告は「卸売在庫・小売在庫・財貿易収支」の advance（速報）。
//     別行の "Wholesale Trade: Sales and Inventories"（10:00 ET）は確報なので拾わない。
const ADVANCE_SERIES = [
  "米 卸売在庫（速報）",
  "米 小売在庫（速報）",
  "米 貿易収支（財・速報）",
] as const;

// List View の HTML から「Advance Economic Indicators Report」行を抽出し、
// sorttable_customkey（ET の YYYYMMDDHHMM）を JST に変換して
// 3 速報系列の ReleaseEvent[] に展開する純関数（テスト用 export）。
export function parseCensusAdvanceTable(html: string): ReleaseEvent[] {
  const out: ReleaseEvent[] = [];
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
  if (!rows) return out;

  for (const row of rows) {
    // 指標名（最初の <a>...</a> のテキスト）。"Advance Economic Indicators Report" 行のみ対象。
    const anchor = row.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
    if (!anchor) continue;
    const name = anchor[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    if (!/advance economic indicators report/i.test(name)) continue;

    // 発表日時は customkey の ET 12 桁（YYYYMMDDHHMM）が最も堅牢。
    const key = row.match(/sorttable_customkey="(\d{12})"/i);
    if (!key) continue;
    const k = key[1];
    const ymdEt = `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}`;
    const etHHMM = `${k.slice(8, 10)}:${k.slice(10, 12)}`;

    const { date, time } = etToJst(ymdEt, etHHMM);
    for (const series of ADVANCE_SERIES) {
      out.push({
        date,
        time,
        country: "US",
        name: series,
        source: SOURCE_LABEL,
        sourceUrl: CENSUS_URL,
      });
    }
  }
  return out;
}

export const censusAdapter: ReleaseAdapter = {
  key: "census-advance",
  label: "センサス局（卸売在庫・小売在庫・財貿易収支 速報）",
  fetchEvents: () =>
    withCache("census-advance", DEFAULT_CACHE_TTL_MS, async () => {
      const res = await fetch(CENSUS_URL, {
        headers: { "User-Agent": RELEASE_PULSE_UA, Accept: "text/html" },
        signal: AbortSignal.timeout(RELEASE_PULSE_FETCH_TIMEOUT_MS),
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseCensusAdvanceTable(await res.text());
    }),
};
