// FRB アダプタ。
// 鉱工業生産（G.17: Industrial Production and Capacity Utilization）の今後のリリース日程を
// 公式の G.17 default ページから取得する。
//   https://www.federalreserve.gov/releases/g17/default.htm
// 構造: <strong>2026:</strong> の後に
//   "January&nbsp;16, February&nbsp;18, ... and December&nbsp;16." のカンマ区切りテキスト。
//   途中に <a>(most recent monthly)</a> が挟まるが、月名+日の直接マッチで吸収する。
//   年は <strong> ラベルから（複数年ブロックがあれば全て拾う）。
// 依存追加を避けるため正規表現ベース。
// 注: FOMC 日程は economic-events.ts に収録済み・verify:cb で裏取り済みのため本アダプタ対象外。

import type { ReleaseAdapter, ReleaseEvent } from "../types.js";
import { withCache, DEFAULT_CACHE_TTL_MS } from "../cache.js";
import {
  etToJst,
  RELEASE_PULSE_UA,
  RELEASE_PULSE_FETCH_TIMEOUT_MS,
} from "../util.js";

const FRB_G17_URL = "https://www.federalreserve.gov/releases/g17/default.htm";
// G.17 月次リリースは 9:15 AM ET 公表（ページ明記）。
const RELEASE_TIME_ET = "09:15";

const MONTH_NAME: Readonly<Record<string, string>> = {
  January: "01", February: "02", March: "03", April: "04",
  May: "05", June: "06", July: "07", August: "08",
  September: "09", October: "10", November: "11", December: "12",
};

// G.17 ページ HTML から <strong>YYYY:</strong>...</p> の各年ブロックを走査し、
// 月名+日の組を全抽出して ReleaseEvent[] にする。
export function parseG17Releases(html: string): ReleaseEvent[] {
  const out: ReleaseEvent[] = [];
  const blockRe = /<strong>(\d{4}):<\/strong>([\s\S]*?)<\/p>/g;
  let bm: RegExpExecArray | null;
  while ((bm = blockRe.exec(html)) !== null) {
    const year = bm[1];
    const body = bm[2];
    const pairRe =
      /(January|February|March|April|May|June|July|August|September|October|November|December)(?:&nbsp;|\s)+(\d{1,2})/g;
    let pm: RegExpExecArray | null;
    while ((pm = pairRe.exec(body)) !== null) {
      const mo = MONTH_NAME[pm[1]];
      if (!mo) continue;
      const ymd = `${year}-${mo}-${pm[2].padStart(2, "0")}`;
      const { date, time } = etToJst(ymd, RELEASE_TIME_ET);
      out.push({
        date,
        time,
        country: "US",
        name: "米 鉱工業生産",
        source: "FRB",
        sourceUrl: FRB_G17_URL,
      });
    }
  }
  return out;
}

export const frbAdapter: ReleaseAdapter = {
  key: "frb",
  label: "FRB（鉱工業生産 G.17）",
  fetchEvents: () =>
    withCache("frb", DEFAULT_CACHE_TTL_MS, async () => {
      const res = await fetch(FRB_G17_URL, {
        headers: { "User-Agent": RELEASE_PULSE_UA, Accept: "text/html" },
        signal: AbortSignal.timeout(RELEASE_PULSE_FETCH_TIMEOUT_MS),
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseG17Releases(await res.text());
    }),
};
