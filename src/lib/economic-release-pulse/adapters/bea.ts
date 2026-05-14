// BEA（米経済分析局）アダプタ。
// 公式の機械可読リリース日程 JSON を取得する。スクレイピング不要・公式 API。
//   https://apps.bea.gov/API/signup/release_dates.json
// 形式: { "<リリース名>": { "release_dates": ["2026-05-28T12:30:00+00:00", ...] }, ... }
// 個人投資家が見る主要 4 系列に絞って ReleaseEvent[] に正規化する。

import type { ReleaseAdapter, ReleaseEvent } from "../types.js";
import { withCache, DEFAULT_CACHE_TTL_MS } from "../cache.js";
import { jstParts, RELEASE_PULSE_UA, RELEASE_PULSE_FETCH_TIMEOUT_MS } from "../util.js";

const BEA_URL = "https://apps.bea.gov/API/signup/release_dates.json";
const BEA_SOURCE_URL = "https://www.bea.gov/news/schedule";

// BEA の release_dates.json のキー → 日本語表示名。
// 全 27 系列のうち、市況で参照される主要指標のみ採用。
const BEA_RELEASES: Readonly<Record<string, string>> = {
  "Gross Domestic Product": "米 GDP",
  "Personal Income and Outlays": "米 個人所得・支出（PCE）",
  "U.S. International Trade in Goods and Services": "米 貿易収支",
  "Corporate Profits": "米 企業収益",
};

type BeaReleaseDates = { release_dates?: unknown };

export const beaAdapter: ReleaseAdapter = {
  key: "bea",
  label: "BEA（米経済分析局）",
  fetchEvents: () =>
    withCache("bea", DEFAULT_CACHE_TTL_MS, async () => {
      const res = await fetch(BEA_URL, {
        headers: { "User-Agent": RELEASE_PULSE_UA, Accept: "application/json" },
        signal: AbortSignal.timeout(RELEASE_PULSE_FETCH_TIMEOUT_MS),
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Record<string, BeaReleaseDates>;

      const out: ReleaseEvent[] = [];
      for (const [key, jpName] of Object.entries(BEA_RELEASES)) {
        const dates = data[key]?.release_dates;
        if (!Array.isArray(dates)) continue;
        for (const raw of dates) {
          if (typeof raw !== "string") continue;
          const ms = Date.parse(raw);
          if (Number.isNaN(ms)) continue;
          const { date, time } = jstParts(ms);
          out.push({
            date,
            time,
            country: "US",
            name: jpName,
            source: "BEA",
            sourceUrl: BEA_SOURCE_URL,
          });
        }
      }
      return out;
    }),
};
