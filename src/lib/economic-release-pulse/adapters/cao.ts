// 内閣府（経済社会総合研究所）アダプタ。
// 「公表予定」ページの先頭テーブル「四半期別GDP速報」を HTML パースする。
//   https://www.esri.cao.go.jp/jp/sna/kouhyou/kouhyou_top.html
// テーブル構造（安定・小サイズ 12KB）:
//   <tr><td>2026年1-3月期（1次速報）</td><td>2026（令和8）年5月19日（火）</td><td>8時50分</td></tr>
// 依存追加を避けるため正規表現ベース（geopolitical-pulse の parseRss と同方針）。

import type { ReleaseAdapter, ReleaseEvent } from "../types.js";
import { withCache, DEFAULT_CACHE_TTL_MS } from "../cache.js";
import { RELEASE_PULSE_UA, RELEASE_PULSE_FETCH_TIMEOUT_MS } from "../util.js";

const CAO_URL = "https://www.esri.cao.go.jp/jp/sna/kouhyou/kouhyou_top.html";

// "2026（令和8）年5月19日（火）" → "2026-05-19"。和暦括弧・曜日は無視。
// "未定" / "2026年12月中旬以降" など precise でないものは null。
export function parseCaoDate(s: string): string | null {
  const m = s.match(/(\d{4})(?:（[^）]*）)?年(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// "8時50分" → "08:50"。"-" 等は null。
export function parseCaoTime(s: string): string | null {
  const m = s.match(/(\d{1,2})時(\d{1,2})分/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2].padStart(2, "0")}`;
}

// 内閣府 公表予定ページ HTML から「四半期別GDP速報」テーブルの行を抽出する。
// 見出し「四半期別GDP速報」直後の最初の <table>...</table> のみ対象。
export function parseCaoGdpTable(html: string): ReleaseEvent[] {
  const tableMatch = html.match(
    /四半期別GDP速報[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/,
  );
  if (!tableMatch) return [];
  const tableInner = tableMatch[1];

  const out: ReleaseEvent[] = [];
  const rowRe = /<tr>([\s\S]*?)<\/tr>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(tableInner)) !== null) {
    const cells = [...rm[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) =>
      c[1].replace(/<[^>]+>/g, "").replace(/\s+/g, "").trim(),
    );
    // thead 行は <th> のみで cells が空 → スキップ
    if (cells.length < 2) continue;
    const [period, dateStr, timeStr] = cells;
    const date = parseCaoDate(dateStr ?? "");
    if (!date) continue; // 「未定」「中旬以降」等はスキップ
    const time = parseCaoTime(timeStr ?? "");
    out.push({
      date,
      ...(time ? { time } : {}),
      country: "JP",
      name: `日 GDP速報 ${period}`,
      source: "内閣府",
      sourceUrl: CAO_URL,
    });
  }
  return out;
}

export const caoAdapter: ReleaseAdapter = {
  key: "cao",
  label: "内閣府（四半期別 GDP 速報）",
  fetchEvents: () =>
    withCache("cao", DEFAULT_CACHE_TTL_MS, async () => {
      const res = await fetch(CAO_URL, {
        headers: { "User-Agent": RELEASE_PULSE_UA, Accept: "text/html" },
        signal: AbortSignal.timeout(RELEASE_PULSE_FETCH_TIMEOUT_MS),
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      return parseCaoGdpTable(html);
    }),
};
