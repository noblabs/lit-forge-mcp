// 日次リターン系列のピアソン相関係数を計算する純関数。
// PERFORMANCE_SYMBOLS（7 銘柄）の closes1y から「直近 30 営業日」のリターンを抽出し、
// 7×7 の相関行列を作って /today の相関ヒートマップで描画する。
//
// データ点不足は null を返し、UI 側で「—」表示にする。

const WINDOW_DAYS = 30;
const MIN_RETURNS = 20; // 30 日中 20 営業日以上ないと信頼性が低いので無効

// closes 配列から「直近 N 営業日のリターン系列」を返す。長さは N - 1。
// データ不足は空配列。
export function tailReturns(
  closes: readonly number[],
  windowDays: number = WINDOW_DAYS,
): number[] {
  const tail = closes.slice(-windowDays - 1);
  if (tail.length < 2) return [];
  const out: number[] = [];
  for (let i = 1; i < tail.length; i++) {
    const prev = tail[i - 1];
    const curr = tail[i];
    if (prev === 0 || typeof prev !== "number" || typeof curr !== "number") continue;
    out.push((curr - prev) / prev);
  }
  return out;
}

// ピアソン相関係数。データ点不足や標準偏差ゼロの場合は null。
export function pearson(
  a: readonly number[],
  b: readonly number[],
): number | null {
  const n = Math.min(a.length, b.length);
  if (n < MIN_RETURNS) return null;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;
  let num = 0;
  let denomA = 0;
  let denomB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denomA += da * da;
    denomB += db * db;
  }
  // 浮動小数の蓄積誤差を考慮して、十分小さい場合も std=0 とみなして null。
  if (denomA < 1e-12 || denomB < 1e-12) return null;
  const denom = Math.sqrt(denomA * denomB);
  if (denom === 0) return null;
  return num / denom;
}

// 銘柄リストと closes1y からの取得関数を受け取り、N×N の相関行列を返す。
// 自身との相関は 1。データ無い銘柄や算出できないペアは null。
export function correlationMatrix(
  symbols: readonly string[],
  getCloses: (symbol: string) => readonly number[] | undefined,
): (number | null)[][] {
  const returns = symbols.map((s) => {
    const closes = getCloses(s);
    return closes ? tailReturns(closes) : [];
  });
  const n = symbols.length;
  const matrix: (number | null)[][] = [];
  for (let i = 0; i < n; i++) {
    const row: (number | null)[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        row.push(returns[i].length >= MIN_RETURNS ? 1 : null);
        continue;
      }
      row.push(pearson(returns[i], returns[j]));
    }
    matrix.push(row);
  }
  return matrix;
}
