// JST 関連ヘルパー。経済指標の日付は全て JST に正規化して扱う。

// UNIX epoch(ms) を JST の { date: "YYYY-MM-DD", time: "HH:MM" } に分解する。
// UTC に +9h して toISOString の UTC 表現を JST 壁時計として使う手法。
export function jstParts(epochMs: number): { date: string; time: string } {
  const jst = new Date(epochMs + 9 * 3600 * 1000);
  const iso = jst.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

// JST の本日（YYYY-MM-DD）。
export function jstToday(now: Date = new Date()): string {
  return jstParts(now.getTime()).date;
}

// JST で now から daysAhead 日後の YYYY-MM-DD。
export function jstDatePlus(daysAhead: number, now: Date = new Date()): string {
  return jstParts(now.getTime() + daysAhead * 24 * 3600 * 1000).date;
}

// 共通 User-Agent。一部の公式サイトは無 UA / bot UA を 403 で弾くため
// ブラウザ系 UA を送る（geopolitical-pulse と同方針）。
export const RELEASE_PULSE_UA =
  "Mozilla/5.0 (compatible; lit-forge-mcp/0.11; +https://github.com/noblabs/lit-forge-mcp)";

export const RELEASE_PULSE_FETCH_TIMEOUT_MS = 12_000;
