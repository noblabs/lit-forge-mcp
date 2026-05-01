// Yahoo Finance v8 chart API ラッパー（MCP server 用）。
// Web 側の app/lib/market/yahoo.ts と同期管理。
// Node 18+ の global fetch を使用、依存追加なし。
// v0.4 で Snapshot を Record<symbol, QuoteResult> 型に変更し、52w 高安・当日高安・出来高・
// 1y close 配列（fetchHistorical）を取得できるよう拡張。

import type { Indicator, Quote, QuoteResult, Snapshot } from "./market-types.js";
import { INDICATORS } from "./indicators.js";

const UA = "Mozilla/5.0 (compatible; lit-forge-mcp/0.4; +https://lit-forge.com/)";
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
