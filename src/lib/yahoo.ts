// Yahoo Finance v8 chart API ラッパー（MCP server 用）。
// Node 18+ の global fetch を使用。
// v0.4 で Snapshot を Record<symbol, QuoteResult> 型に変更し、52w 高安・当日高安・出来高・
// 1y close 配列（fetchHistorical）を取得できるよう拡張。
// v0.6.0 で yahoo-finance2 を導入し、quoteSummary 経由でファンダメンタル / アナリスト / 配当履歴を取得。
// quoteSummary は v10 API + crumb 認証が必要なため、自前 fetch では実装せず yahoo-finance2 に委譲。

import YahooFinance from "yahoo-finance2";
import type {
  AnalystConsensus,
  DividendRecord,
  Indicator,
  Quote,
  QuoteFundamentals,
  QuoteResult,
  Snapshot,
} from "./market-types.js";
import { INDICATORS } from "./indicators.js";

// MCP は stdio 通信のため、yahoo-finance2 のサーベイ通知や notice が stdout に流れると壊れる。
// suppressNotices で全ての通知を抑止。
const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

const UA = "Mozilla/5.0 (compatible; lit-forge-mcp/0.4; +https://github.com/noblabs/lit-forge-mcp)";
const TIMEOUT_MS = 4000;

export class YahooFinanceError extends Error {
  constructor(
    public readonly symbol: string,
    public readonly status: number,
    message?: string,
  ) {
    super(message ?? `Yahoo Finance API ${symbol}: HTTP ${status}`);
    this.name = "YahooFinanceError";
  }
}

type YahooChartResponse = {
  chart: {
    result?: Array<{
      meta: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketTime?: number;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        regularMarketVolume?: number;
      };
      indicators: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
    error?: { code: string; description: string } | null;
  };
};

async function fetchRaw(symbol: string): Promise<Quote> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=1d&interval=15m`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    throw new YahooFinanceError(symbol, 0, `Yahoo Finance ${symbol}: ${msg}`);
  }
  if (!res.ok) throw new YahooFinanceError(symbol, res.status);
  const data = (await res.json()) as YahooChartResponse;
  const result = data.chart.result?.[0];
  if (!result) {
    const desc = data.chart.error?.description ?? "empty result";
    throw new YahooFinanceError(symbol, 0, `Yahoo Finance ${symbol}: ${desc}`);
  }
  const meta = result.meta;
  const price = meta.regularMarketPrice;
  const previousClose = meta.chartPreviousClose ?? meta.previousClose;
  if (typeof price !== "number" || typeof previousClose !== "number") {
    throw new YahooFinanceError(
      symbol,
      0,
      `Yahoo Finance ${symbol}: missing price/previousClose`,
    );
  }
  const change = price - previousClose;
  const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;
  const changeBp = change * 100;
  const fetchedAt = new Date(
    meta.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now(),
  ).toISOString();
  const sparkline = (result.indicators.quote?.[0]?.close ?? []).filter(
    (v): v is number => typeof v === "number",
  );
  return {
    symbol,
    displayName: symbol,
    category: "fx",
    unit: "",
    price,
    previousClose,
    change,
    changePercent,
    changeBp,
    fetchedAt,
    sparkline,
    fiftyTwoWeekHigh:
      typeof meta.fiftyTwoWeekHigh === "number" ? meta.fiftyTwoWeekHigh : undefined,
    fiftyTwoWeekLow:
      typeof meta.fiftyTwoWeekLow === "number" ? meta.fiftyTwoWeekLow : undefined,
    dayHigh:
      typeof meta.regularMarketDayHigh === "number"
        ? meta.regularMarketDayHigh
        : undefined,
    dayLow:
      typeof meta.regularMarketDayLow === "number"
        ? meta.regularMarketDayLow
        : undefined,
    volume:
      typeof meta.regularMarketVolume === "number"
        ? meta.regularMarketVolume
        : undefined,
  };
}

// 任意 ticker の 1y 日足 close 配列を取得（PERFORMANCE_SYMBOLS 等の分析用）。
export async function fetchHistorical(symbol: string): Promise<number[]> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=1y&interval=1d`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    throw new YahooFinanceError(symbol, 0, `Yahoo Finance ${symbol} (hist): ${msg}`);
  }
  if (!res.ok) throw new YahooFinanceError(symbol, res.status);
  const data = (await res.json()) as YahooChartResponse;
  const result = data.chart.result?.[0];
  if (!result) {
    const desc = data.chart.error?.description ?? "empty result";
    throw new YahooFinanceError(symbol, 0, `Yahoo Finance ${symbol} (hist): ${desc}`);
  }
  return (result.indicators.quote?.[0]?.close ?? []).filter(
    (v): v is number => typeof v === "number",
  );
}

// indicator のメタ（displayName / category / unit）を Quote に上書き。
function applyMeta(quote: Quote, indicator: Indicator): Quote {
  return {
    ...quote,
    displayName: indicator.displayName,
    category: indicator.category,
    unit: indicator.unit,
  };
}

// indicator から fetch、失敗時は fallback を試す。
export async function fetchQuoteForIndicator(
  indicator: Indicator,
): Promise<QuoteResult> {
  try {
    const quote = await fetchRaw(indicator.symbol);
    return applyMeta(quote, indicator);
  } catch (primaryErr) {
    if (!indicator.fallback) {
      const m = primaryErr instanceof Error ? primaryErr.message : "unknown";
      return { error: m };
    }
    try {
      const quote = await fetchRaw(indicator.fallback);
      return applyMeta(quote, indicator);
    } catch (fallbackErr) {
      const m1 = primaryErr instanceof Error ? primaryErr.message : "primary";
      const m2 = fallbackErr instanceof Error ? fallbackErr.message : "fallback";
      return { error: `${m1} / ${m2}` };
    }
  }
}

// 任意の symbol を 1 件取得（get_quote ツール用）。
export async function fetchQuoteBySymbol(symbol: string): Promise<Quote> {
  return fetchRaw(symbol);
}

// 全 INDICATORS（28 銘柄）を並列取得して Snapshot を返す。
// quotes は Record<symbol, QuoteResult>。Web 側と同型。
export async function fetchSnapshot(): Promise<Snapshot> {
  const settled = await Promise.allSettled(
    INDICATORS.map(async (ind) => [ind.symbol, await fetchQuoteForIndicator(ind)] as const),
  );
  const quotes: Record<string, QuoteResult> = {};
  for (const r of settled) {
    if (r.status === "fulfilled") {
      const [symbol, q] = r.value;
      quotes[symbol] = q;
    }
  }
  return { fetchedAt: new Date().toISOString(), quotes };
}

// 任意 symbol リストを並列取得（sectors / mag7 / fangplus 等のサブセット用）。
export async function fetchSubsetSnapshot(
  symbols: readonly string[],
): Promise<Record<string, QuoteResult>> {
  const settled = await Promise.allSettled(
    symbols.map(async (s) => {
      try {
        const quote = await fetchRaw(s);
        return [s, quote] as const;
      } catch (err) {
        const m = err instanceof Error ? err.message : "fetch failed";
        return [s, { error: m }] as const;
      }
    }),
  );
  const out: Record<string, QuoteResult> = {};
  for (const r of settled) {
    if (r.status === "fulfilled") {
      const [symbol, q] = r.value;
      out[symbol] = q;
    }
  }
  return out;
}

// recommendationKey の日本語化（v0.6.0、純関数のためテスト容易）
export function recommendationLabel(key: string | undefined): string | undefined {
  if (!key) return undefined;
  switch (key.toLowerCase()) {
    case "strong_buy":
      return "強気買い";
    case "buy":
    case "outperform":
      return "買い";
    case "hold":
    case "neutral":
      return "中立";
    case "sell":
    case "underperform":
      return "売り";
    case "strong_sell":
      return "強気売り";
    default:
      return undefined;
  }
}

// yahoo-finance2 のレスポンス型は深いパスにあり、root export されていない。
// 必要部分のみインライン型で受けることでバージョン耐性を高める（フィールドは全て optional）。
type QuoteSummaryResp = {
  summaryDetail?: {
    trailingPE?: number;
    forwardPE?: number;
    dividendYield?: number;
    payoutRatio?: number;
    beta?: number;
    marketCap?: number;
    averageDailyVolume3Month?: number;
  };
  defaultKeyStatistics?: {
    forwardPE?: number;
    priceToBook?: number;
  };
  financialData?: {
    recommendationKey?: string;
    recommendationMean?: number;
    targetMeanPrice?: number;
    targetHighPrice?: number;
    targetLowPrice?: number;
    numberOfAnalystOpinions?: number;
  };
  recommendationTrend?: {
    trend?: Array<{
      period: string;
      strongBuy?: number;
      buy?: number;
      hold?: number;
      sell?: number;
      strongSell?: number;
    }>;
  };
};

type ChartResp = {
  events?: {
    dividends?: Array<{ date: Date | number | string; amount: number }>;
  };
};

// 株式のファンダメンタル指標を取得（v0.6.0）。指数・暗号資産・FX 等では大半 undefined。
export async function fetchFundamentals(
  symbol: string,
): Promise<QuoteFundamentals> {
  let r: QuoteSummaryResp;
  try {
    r = (await yf.quoteSummary(symbol, {
      modules: ["summaryDetail", "defaultKeyStatistics"],
    })) as QuoteSummaryResp;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    throw new YahooFinanceError(symbol, 0, `Yahoo Finance ${symbol} (fundamentals): ${msg}`);
  }
  const sd = r.summaryDetail;
  const ks = r.defaultKeyStatistics;
  // Yahoo Finance の dividendYield は基本 0-1 の小数表記（0.0234 = 2.34%）。
  return {
    trailingPE: sd?.trailingPE,
    forwardPE: ks?.forwardPE ?? sd?.forwardPE,
    priceToBook: ks?.priceToBook,
    dividendYield: sd?.dividendYield,
    payoutRatio: sd?.payoutRatio,
    beta: sd?.beta,
    marketCap: sd?.marketCap,
    averageDailyVolume3M: sd?.averageDailyVolume3Month,
  };
}

// アナリストコンセンサスを取得（v0.6.0）。
// numberOfAnalystOpinions が 0 や undefined の銘柄では空に近いオブジェクトを返す。
export async function fetchAnalystConsensus(
  symbol: string,
): Promise<AnalystConsensus> {
  let r: QuoteSummaryResp;
  try {
    r = (await yf.quoteSummary(symbol, {
      modules: ["financialData", "recommendationTrend"],
    })) as QuoteSummaryResp;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    throw new YahooFinanceError(symbol, 0, `Yahoo Finance ${symbol} (analyst): ${msg}`);
  }
  const fd = r.financialData;
  const rt = r.recommendationTrend?.trend ?? [];
  return {
    recommendationKey: fd?.recommendationKey,
    recommendationLabel: recommendationLabel(fd?.recommendationKey),
    recommendationMean: fd?.recommendationMean,
    targetMeanPrice: fd?.targetMeanPrice,
    targetHighPrice: fd?.targetHighPrice,
    targetLowPrice: fd?.targetLowPrice,
    numberOfAnalystOpinions: fd?.numberOfAnalystOpinions,
    byMonth: rt.map((t) => ({
      period: t.period,
      strongBuy: t.strongBuy ?? 0,
      buy: t.buy ?? 0,
      hold: t.hold ?? 0,
      sell: t.sell ?? 0,
      strongSell: t.strongSell ?? 0,
    })),
  };
}

// 配当履歴を取得（v0.6.0）。配当ゼロ銘柄は空配列を返す。
export async function fetchDividendHistory(
  symbol: string,
  rangeYears: 1 | 3 | 5 | 10,
): Promise<DividendRecord[]> {
  const period2 = new Date();
  const period1 = new Date();
  period1.setFullYear(period1.getFullYear() - rangeYears);
  let chart: ChartResp;
  try {
    chart = (await yf.chart(symbol, {
      period1,
      period2,
      interval: "1mo",
      events: "dividends",
    })) as ChartResp;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    throw new YahooFinanceError(symbol, 0, `Yahoo Finance ${symbol} (dividends): ${msg}`);
  }
  const events = chart.events?.dividends ?? [];
  return events
    .map((d): DividendRecord => ({
      date: new Date(d.date).toISOString().slice(0, 10),
      amount: d.amount,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// 配当履歴から暦年ごとの合計を計算する純関数（v0.6.0、テスト容易）。
export function aggregateDividendsByYear(
  dividends: ReadonlyArray<DividendRecord>,
): Record<number, number> {
  const out: Record<number, number> = {};
  for (const d of dividends) {
    const year = parseInt(d.date.slice(0, 4), 10);
    if (Number.isFinite(year)) {
      out[year] = (out[year] ?? 0) + d.amount;
    }
  }
  return out;
}
