// 単純移動平均（SMA）の計算純関数。
// PeriodChart の 50 日 / 200 日線オーバーレイ、quartile.ts の 200 日線クロス検出、
// rankings.ts の期間別パフォーマンス計算などで共通利用する。

// 配列に対する N 期間 SMA を返す。先頭 N-1 個は null（データ不足）。
export function rollingSMA(
  values: readonly number[],
  window: number,
): (number | null)[] {
  if (window <= 0) return values.map(() => null);
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    if (i >= window - 1) {
      out.push(sum / window);
    } else {
      out.push(null);
    }
  }
  return out;
}

// 末尾 N 期間の SMA 単一値。データ不足は null。
export function lastSMA(
  values: readonly number[],
  window: number,
): number | null {
  if (values.length < window || window <= 0) return null;
  let sum = 0;
  for (let i = values.length - window; i < values.length; i++) {
    sum += values[i];
  }
  return sum / window;
}
