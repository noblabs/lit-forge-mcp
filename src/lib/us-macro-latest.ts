// 米マクロ最新値取得（v0.13.0 新設）。
// BLS（米労働統計局）の Public Data API v2 から雇用統計・失業率・CPI・PPI の
// 4 系列を 1 リクエストで取得し、最新月の値 + 前月差・前月比 + 前年同月差・前年同月比に
// 正規化して返す。
//
// 設計背景:
//   - BLS の HTML schedule ページと RSS フィードは Akamai bot 管理で 403 され取得不能
//     （ToS で「robots/bots は禁止」と公式表明）。
//   - 一方、公開 API は無認証で 1 日 25 リクエストまで使え、bot 制限の対象外。
//   - そのため「次回発表予定」自動取得は道がないが、「最新発表値」は API 経由で完全に取得可能。
//   - 本モジュールは get_market_snapshot（市況値）のマクロ指標版という位置づけ。
//     発表予定日は get_economic_release_pulse / get_economic_events_today を併用すること。
//
// キャッシュ・UA・タイムアウトは economic-release-pulse の共有ユーティリティを再利用。
// 将来共通ライブラリへの昇格余地あり。

import { withCache, DEFAULT_CACHE_TTL_MS } from "./economic-release-pulse/cache.js";
import {
  RELEASE_PULSE_UA,
  RELEASE_PULSE_FETCH_TIMEOUT_MS,
} from "./economic-release-pulse/util.js";

const BLS_API_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/";

// 系列定義（4 系列に固定。JOLTS・実質賃金等は v0.14.0 以降の拡張余地）。
type IndicatorKey = "nonfarmPayrolls" | "unemploymentRate" | "cpi" | "ppi";

type SeriesDef = {
  id: string;
  key: IndicatorKey;
  displayName: string;
  unit: string;
};

const SERIES: readonly SeriesDef[] = [
  {
    id: "CES0000000001",
    key: "nonfarmPayrolls",
    displayName: "米 雇用統計（非農業部門就業者数）",
    unit: "千人",
  },
  {
    id: "LNS14000000",
    key: "unemploymentRate",
    displayName: "米 失業率",
    unit: "%",
  },
  {
    id: "CUUR0000SA0",
    key: "cpi",
    displayName: "米 CPI（都市部全消費者、1982-84=100）",
    unit: "index",
  },
  {
    id: "WPSFD4",
    key: "ppi",
    displayName: "米 PPI（最終需要、2009=100）",
    unit: "index",
  },
];

// BLS API v2 レスポンスのデータ 1 件。data 配列は新しい→古い順で返る。
export type BlsSeriesDatum = {
  year: string;
  period: string; // "M01" - "M12"
  periodName: string;
  value: string; // "158736" or "-"（欠損）
  latest?: string; // "true" のとき最新
  footnotes?: Array<{ code?: string; text?: string }>;
};

type BlsApiResponse = {
  status: string;
  message?: string[];
  Results?: {
    series: Array<{ seriesID: string; data: BlsSeriesDatum[] }>;
  };
};

export type IndicatorSummary = {
  displayName: string;
  unit: string;
  latest: {
    year: number;
    month: number; // 1-12, 取得失敗時は 0
    value: number | null;
    preliminary: boolean;
  };
  // 最新値が null の場合は省略される
  monthOverMonth?: { diff: number | null; percent: number | null };
  yearOverYear?: { diff: number | null; percent: number | null };
};

export type UsMacroLatest = {
  fetchedAt: string;
  source: string;
  indicators: Record<IndicatorKey, IndicatorSummary>;
};

// "M01" -> 1。月レコード以外（M13=年間平均など）は null。
function periodToMonth(period: string): number | null {
  if (!/^M(0[1-9]|1[0-2])$/.test(period)) return null;
  return parseInt(period.slice(1), 10);
}

// "158736" -> 158736、"-" や空文字は null（BLS の欠損表現）。
function parseValue(raw: string | undefined): number | null {
  if (!raw || raw === "-" || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// BLS 速報判定: footnotes に code "P" があれば preliminary。
function isPreliminary(rec: BlsSeriesDatum): boolean {
  return (rec.footnotes ?? []).some((f) => f?.code === "P");
}

function findByYM(
  data: BlsSeriesDatum[],
  year: number,
  month: number,
): BlsSeriesDatum | undefined {
  return data.find(
    (d) => Number(d.year) === year && periodToMonth(d.period) === month,
  );
}

function roundTo(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

// 1 系列の data 配列を IndicatorSummary に正規化する純関数（テスト容易性のため export）。
export function summarizeSeries(
  def: SeriesDef,
  data: BlsSeriesDatum[],
): IndicatorSummary {
  // 月次レコードのみに絞る（M13 等を除外）。
  const monthly = data.filter((d) => periodToMonth(d.period) !== null);
  // latest フラグがあればそれを優先、無ければ配列先頭（API は新しい→古い順で返す）。
  const latestRec = monthly.find((d) => d.latest === "true") ?? monthly[0];
  if (!latestRec) {
    return {
      displayName: def.displayName,
      unit: def.unit,
      latest: { year: 0, month: 0, value: null, preliminary: false },
    };
  }
  const latestYear = Number(latestRec.year);
  const latestMonth = periodToMonth(latestRec.period) ?? 0;
  const latestValue = parseValue(latestRec.value);

  const summary: IndicatorSummary = {
    displayName: def.displayName,
    unit: def.unit,
    latest: {
      year: latestYear,
      month: latestMonth,
      value: latestValue,
      preliminary: isPreliminary(latestRec),
    },
  };

  if (latestValue === null) return summary;

  // 前月（1 月なら前年 12 月）。
  const prevYear = latestMonth === 1 ? latestYear - 1 : latestYear;
  const prevMonth = latestMonth === 1 ? 12 : latestMonth - 1;
  const prevValue = parseValue(findByYM(monthly, prevYear, prevMonth)?.value);

  // 前年同月。
  const yoyValue = parseValue(findByYM(monthly, latestYear - 1, latestMonth)?.value);

  summary.monthOverMonth = {
    diff: prevValue !== null ? roundTo(latestValue - prevValue, 3) : null,
    percent:
      prevValue !== null && prevValue !== 0
        ? roundTo(((latestValue - prevValue) / prevValue) * 100, 3)
        : null,
  };
  summary.yearOverYear = {
    diff: yoyValue !== null ? roundTo(latestValue - yoyValue, 3) : null,
    percent:
      yoyValue !== null && yoyValue !== 0
        ? roundTo(((latestValue - yoyValue) / yoyValue) * 100, 3)
        : null,
  };

  return summary;
}

// 全 4 系列をまとめて API 取得し、IndicatorSummary に正規化する。
// キャッシュは既存共有の 6 時間 TTL を再利用。
export async function fetchUsMacroLatest(): Promise<UsMacroLatest> {
  return withCache("bls-us-macro-latest", DEFAULT_CACHE_TTL_MS, async () => {
    const now = new Date();
    const endYear = now.getUTCFullYear();
    // 前年同月比のため 2 年分（年単位指定）取得する。
    const startYear = endYear - 1;

    const res = await fetch(BLS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": RELEASE_PULSE_UA,
        Accept: "application/json",
      },
      body: JSON.stringify({
        seriesid: SERIES.map((s) => s.id),
        startyear: String(startYear),
        endyear: String(endYear),
      }),
      signal: AbortSignal.timeout(RELEASE_PULSE_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`BLS API HTTP ${res.status}`);

    const data = (await res.json()) as BlsApiResponse;
    if (data.status !== "REQUEST_SUCCEEDED") {
      const detail = data.message?.length ? ` (${data.message.join("; ")})` : "";
      throw new Error(`BLS API failed: ${data.status}${detail}`);
    }
    const seriesList = data.Results?.series ?? [];

    const indicators = {} as Record<IndicatorKey, IndicatorSummary>;
    for (const def of SERIES) {
      const found = seriesList.find((s) => s.seriesID === def.id);
      indicators[def.key] = summarizeSeries(def, found?.data ?? []);
    }

    return {
      fetchedAt: new Date().toISOString(),
      source: "BLS Public Data API v2",
      indicators,
    };
  });
}
