// 期間別パフォーマンス計算（純関数）。
// 日足 close 配列のインデックス基準で「直近 5 営業日 / 約 1 ヶ月（21 営業日）/ 約 1 年（252 営業日）」
// に対する % 変化率を返す。データ点が足りない場合は null。
//
// 暦日ベースだと休場日を巡って境界がぶれる（金曜の close が「1 週間前」なのか「5 営業日前」なのか）ため、
// 「Yahoo の日足配列から N 件遡る」という素朴な定義で運用する。文言は「1w / 1m / 1y」と短縮表示し、
// 厳密には「直近 5 / 21 / 252 営業日」だがユーザー視点での体感で十分という割り切り。

import type { PerformanceWindow } from "./market-types.js";

const D7_INDEX = 5; // 直近 5 営業日前
const D30_INDEX = 21; // 約 1 ヶ月前
const D365_INDEX = 252; // 約 1 年前

// 単一の遡及インデックスに対する変化率（%）。データ不足は null。
function changePercent(
  closes: readonly number[],
  backIndex: number,
): number | null {
  if (closes.length <= backIndex) return null;
  const today = closes[closes.length - 1];
  const past = closes[closes.length - 1 - backIndex];
  if (typeof today !== "number" || typeof past !== "number") return null;
  if (past === 0) return null;
  return ((today - past) / past) * 100;
}

// 日足 close 配列から d7 / d30 / d365 を一括計算。
export function computePerformance(
  closes: readonly number[],
): PerformanceWindow {
  return {
    d7: changePercent(closes, D7_INDEX),
    d30: changePercent(closes, D30_INDEX),
    d365: changePercent(closes, D365_INDEX),
  };
}

// /today で期間別パフォーマンス + 1y 期間タブ + 分位値表示を有効化する銘柄。
// Yahoo の追加 fetch（1y 日足）はこの銘柄のみで実施。ISR 24h + Redis 7d でキャッシュ。
// v1.54 で 3 → 7 に拡張：マクロ俯瞰の主要グループを網羅。
export const PERFORMANCE_SYMBOLS: readonly string[] = [
  "JPY=X", // USD/JPY
  "^GSPC", // S&P 500
  "^NDX", // NASDAQ 100
  "^DJI", // NY ダウ
  "^TNX", // 米10年債利回り
  "^VIX", // VIX
  "DX-Y.NYB", // ドル指数
];
