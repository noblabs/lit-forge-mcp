// Yahoo Finance v8 chart API ラッパー（MCP server 用）。
// Web 側の app/lib/market/yahoo.ts と同期管理。
// Node 18+ の global fetch を使用、依存追加なし。

import type { Indicator, Quote, QuoteResult, Snapshot } from "./market-types.js";
import { INDICATORS } from "./indicators.js";

const UA = "Mozilla/5.0 (compatible; lit-forge-mcp/0.3; +https://lit-forge.com/)";
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
  return {
    symbol,
    displayName: symbol,
    category: "fx",
    price,
    previousClose,
    change,
    changePercent,
    changeBp,
    unit: "",
    fetchedAt,
  };
}

// indicator のメタを Quote に上書きして返す。
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
      return { symbol: indicator.symbol, error: m };
    }
    try {
      const quote = await fetchRaw(indicator.fallback);
      return applyMeta(quote, indicator);
    } catch (fallbackErr) {
      const m1 = primaryErr instanceof Error ? primaryErr.message : "primary";
      const m2 = fallbackErr instanceof Error ? fallbackErr.message : "fallback";
      return { symbol: indicator.symbol, error: `${m1} / ${m2}` };
    }
  }
}

// 任意の symbol を 1 件取得（get_quote ツール用）。
export async function fetchQuoteBySymbol(symbol: string): Promise<Quote> {
  return fetchRaw(symbol);
}

// 9 銘柄を並列取得して Snapshot を返す。
export async function fetchSnapshot(): Promise<Snapshot> {
  const results = await Promise.allSettled(
    INDICATORS.map((ind) => fetchQuoteForIndicator(ind)),
  );
  const quotes: QuoteResult[] = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      symbol: INDICATORS[i].symbol,
      error: r.reason instanceof Error ? r.reason.message : "unknown",
    };
  });
  return { fetchedAt: new Date().toISOString(), quotes };
}
