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

// ある月の第 n 日曜日の日（1-31）を返す。
function nthSundayOfMonth(year: number, month0: number, n: number): number {
  const firstDow = new Date(Date.UTC(year, month0, 1)).getUTCDay(); // 0=日
  const firstSunday = 1 + ((7 - firstDow) % 7);
  return firstSunday + (n - 1) * 7;
}

// 与えられた YYYY-MM-DD が米東部夏時間（EDT, UTC-4）期間内かを判定する。
// 米 DST: 3 月第 2 日曜 02:00 〜 11 月第 1 日曜 02:00。
// 経済指標のリリースは午前なので 02:00 の切替時刻は無視し、日付レベルで判定する
// （切替日当日: 3 月開始日は EDT 扱い・11 月終了日は EST 扱い、午前リリースとして正しい）。
export function isUsEasternDst(ymd: string): boolean {
  const [y, mo, d] = ymd.split("-").map(Number);
  if (!y || !mo || !d) return false;
  const dstStart = nthSundayOfMonth(y, 2, 2); // 3 月（month0=2）第 2 日曜
  const dstEnd = nthSundayOfMonth(y, 10, 1); // 11 月（month0=10）第 1 日曜
  const cur = mo * 100 + d;
  return cur >= 3 * 100 + dstStart && cur < 11 * 100 + dstEnd;
}

// 米東部時間（ET）の YYYY-MM-DD + HH:MM を JST の { date, time } に変換する。
// EDT は UTC-4 → JST(+9) は ET+13h、EST は UTC-5 → ET+14h。
// 午前 ET は夜 JST で同日内に収まるが、繰り上がりも一般的に処理する。
export function etToJst(ymd: string, etHHMM: string): { date: string; time: string } {
  const [eh, em] = etHHMM.split(":").map(Number);
  const offsetH = isUsEasternDst(ymd) ? 13 : 14;
  let jh = eh + offsetH;
  let dayShift = 0;
  while (jh >= 24) {
    jh -= 24;
    dayShift += 1;
  }
  let date = ymd;
  if (dayShift > 0) {
    const [y, mo, d] = ymd.split("-").map(Number);
    date = new Date(Date.UTC(y, mo - 1, d + dayShift)).toISOString().slice(0, 10);
  }
  const time = `${String(jh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
  return { date, time };
}
