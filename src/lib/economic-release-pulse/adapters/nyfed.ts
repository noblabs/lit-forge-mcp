// NY 連銀アダプタ。
// Empire State Manufacturing Survey（NY 連銀製造業景気指数）の今後のリリース日程を
// 公式の overview ページから取得する。
//   https://www.newyorkfed.org/survey/empire/empiresurvey_overview.html
// 構造: <table class="greyborder"> に「月名ヘッダ行 + 日付行」のグリッド（3 段 × 4 か月）。
//   月ヘッダ: <td class="tdhdrcol(R)"...><div>JAN</div> が文書順に 12 個
//   日付セル: <td class="dirCol"...><div>15<a href="...empire2026/..."> が文書順に 12 個
//   年: 日付セル内の PDF href（.../empire2026/...）から抽出
// 依存追加を避けるため正規表現ベース（cao.ts / parseRss と同方針）。

import type { ReleaseAdapter, ReleaseEvent } from "../types.js";
import { withCache, DEFAULT_CACHE_TTL_MS } from "../cache.js";
import {
  etToJst,
  jstToday,
  RELEASE_PULSE_UA,
  RELEASE_PULSE_FETCH_TIMEOUT_MS,
} from "../util.js";

const NYFED_URL =
  "https://www.newyorkfed.org/survey/empire/empiresurvey_overview.html";
// Empire State Manufacturing Survey は 8:30 AM ET 公表（ページ明記）。
const RELEASE_TIME_ET = "08:30";

const MONTH_ABBR: Readonly<Record<string, string>> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

// Empire State の overview ページ HTML から greyborder テーブルを抽出し、
// 月名ヘッダ配列と日付セル配列を文書順で zip して ReleaseEvent[] にする。
export function parseEmpireStateTable(html: string): ReleaseEvent[] {
  const tableMatch = html.match(
    /<table[^>]*class="greyborder"[\s\S]*?<\/table>/i,
  );
  if (!tableMatch) return [];
  const inner = tableMatch[0];

  const months = [
    ...inner.matchAll(/class="tdhdrcol[^"]*"[^>]*>\s*<div>\s*([A-Za-z]{3})/g),
  ].map((m) => m[1].toUpperCase());
  const days = [
    ...inner.matchAll(/class="dirCol"[^>]*>\s*<div>\s*(\d{1,2})/g),
  ].map((m) => m[1]);

  // 年は PDF href（.../empire2026/...）から。取れなければ現在 JST 年。
  const yearMatch = inner.match(/empire(\d{4})/);
  const year = yearMatch ? yearMatch[1] : jstToday().slice(0, 4);

  const out: ReleaseEvent[] = [];
  const n = Math.min(months.length, days.length);
  for (let i = 0; i < n; i++) {
    const mo = MONTH_ABBR[months[i]];
    if (!mo) continue;
    const ymd = `${year}-${mo}-${days[i].padStart(2, "0")}`;
    const { date, time } = etToJst(ymd, RELEASE_TIME_ET);
    out.push({
      date,
      time,
      country: "US",
      name: "米 NY 連銀製造業景気指数",
      source: "NY 連銀",
      sourceUrl: NYFED_URL,
    });
  }
  return out;
}

export const nyfedAdapter: ReleaseAdapter = {
  key: "nyfed",
  label: "NY 連銀（Empire State 製造業景気指数）",
  fetchEvents: () =>
    withCache("nyfed", DEFAULT_CACHE_TTL_MS, async () => {
      const res = await fetch(NYFED_URL, {
        headers: { "User-Agent": RELEASE_PULSE_UA, Accept: "text/html" },
        signal: AbortSignal.timeout(RELEASE_PULSE_FETCH_TIMEOUT_MS),
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseEmpireStateTable(await res.text());
    }),
};
