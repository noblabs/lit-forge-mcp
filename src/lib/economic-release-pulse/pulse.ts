// 経済指標リリース予定アグリゲータ。
// 全アダプタを並列実行し、エラーを隔離（部分成功）、国/期間フィルタ・dedupe・ソートして返す。
// geopolitical-pulse.ts の fetchPulse と同じ構造。

import type {
  AdapterResult,
  ReleaseAdapter,
  ReleaseCountry,
  ReleaseEvent,
} from "./types.js";
import { jstToday, jstDatePlus } from "./util.js";
import { beaAdapter } from "./adapters/bea.js";
import { caoAdapter } from "./adapters/cao.js";
import { bojAdapter } from "./adapters/boj.js";
import { nyfedAdapter } from "./adapters/nyfed.js";
import { frbAdapter } from "./adapters/frb.js";
import { pfeiAdapter } from "./adapters/pfei.js";
import { dolEtaAdapter } from "./adapters/dol-eta.js";
import { spGlobalPmiAdapter } from "./adapters/sp-global-pmi.js";
import { censusAdapter } from "./adapters/census.js";

// 登録アダプタ。新ソース追加時はここに 1 行足す。
// 次サイクル候補: 総務省統計局（日 CPI）、FOMC。
const ADAPTERS: readonly ReleaseAdapter[] = [
  beaAdapter,
  caoAdapter,
  bojAdapter,
  nyfedAdapter,
  frbAdapter,
  pfeiAdapter,
  dolEtaAdapter,
  spGlobalPmiAdapter,
  censusAdapter,
];

export type ReleaseRange = "today" | "week";

export type EconomicReleasePulse = {
  fetchedAt: string;
  today: string;
  range: ReleaseRange;
  sources: AdapterResult[];
  events: ReleaseEvent[];
};

// date(YYYY-MM-DD) が [from, to] の範囲内か（文字列比較で OK）。
function inRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

// 全アダプタ並列実行 → 国/期間フィルタ → dedupe → 日時ソート。
export async function fetchEconomicReleasePulse(opts: {
  range: ReleaseRange;
  country?: ReleaseCountry;
  now?: Date;
}): Promise<EconomicReleasePulse> {
  const now = opts.now ?? new Date();
  const today = jstToday(now);
  const to = opts.range === "week" ? jstDatePlus(6, now) : today;

  const settled = await Promise.all(
    ADAPTERS.map(
      async (
        a,
      ): Promise<{ result: AdapterResult; events: ReleaseEvent[] }> => {
        const t0 = Date.now();
        try {
          const events = await a.fetchEvents();
          return {
            result: {
              key: a.key,
              label: a.label,
              ok: true,
              count: events.length,
              elapsedMs: Date.now() - t0,
            },
            events,
          };
        } catch (e) {
          const msg = e instanceof Error ? e.message : "fetch failed";
          return {
            result: {
              key: a.key,
              label: a.label,
              ok: false,
              count: 0,
              error: msg,
              elapsedMs: Date.now() - t0,
            },
            events: [],
          };
        }
      },
    ),
  );

  let events = settled.flatMap((s) => s.events);
  if (opts.country) {
    events = events.filter((e) => e.country === opts.country);
  }
  events = events.filter((e) => inRange(e.date, today, to));

  // dedupe（date|time|country|name）。BEA は同一日が重複することがあるため必須。
  const seen = new Set<string>();
  const deduped: ReleaseEvent[] = [];
  for (const e of events) {
    const k = `${e.date}|${e.time ?? ""}|${e.country}|${e.name}`;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(e);
  }

  deduped.sort((a, b) =>
    (a.date + (a.time ?? "99:99")).localeCompare(b.date + (b.time ?? "99:99")),
  );

  return {
    fetchedAt: new Date().toISOString(),
    today,
    range: opts.range,
    sources: settled.map((s) => s.result),
    events: deduped,
  };
}
