// 過去 1 年（≒ 252 営業日）の close 配列に対する現在値の分位値（パーセンタイル）を計算。
// 「現在値が過去 1 年で X% の位置（0=最安、100=最高）」を返す。
// /today の MarketCard 上で「過去1年で上位X%」のようなヒストリカル文脈表示に使う。

const MIN_POINTS = 30; // この点数未満は分位値を算出しない（信頼性低）

// closes に対する現在値（= 末尾要素）のパーセンタイル順位（0..100）。
// データ点不足は null。
export function pricePercentile(closes: readonly number[]): number | null {
  if (closes.length < MIN_POINTS) return null;
  const current = closes[closes.length - 1];
  if (typeof current !== "number" || Number.isNaN(current)) return null;
  // 末尾要素を除いた過去履歴に対してランクを取る（自己一致を除外）
  const past = closes.slice(0, -1);
  const lessOrEq = past.filter((v) => v <= current).length;
  return (lessOrEq / past.length) * 100;
}

// 過去 1 年の closes 配列から 1 営業日変化率（%）の標準偏差を求め、
// 当日変化率が ±1σ を超えているかを判定する。データ不足は null。
// /today カードの「⚡ 大きな動き」マークに使用。
export type OutlierResult = {
  // ±sigma 倍数（例: +2.3 なら +2.3σ の動き）
  sigma: number;
  // 1σ 超過しているか
  exceeds1Sigma: boolean;
};

export function detectOutlier(
  closes: readonly number[],
  todayChangePercent: number,
): OutlierResult | null {
  if (closes.length < MIN_POINTS) return null;
  // 各営業日変化率の系列を作る
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const curr = closes[i];
    if (prev === 0 || typeof prev !== "number" || typeof curr !== "number") continue;
    returns.push(((curr - prev) / prev) * 100);
  }
  if (returns.length < MIN_POINTS) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
  const std = Math.sqrt(variance);
  if (std === 0) return null;
  const sigma = (todayChangePercent - mean) / std;
  return { sigma, exceeds1Sigma: Math.abs(sigma) >= 1 };
}

// 重要レベル検出：52 週新高値 / 新安値 / 200 日線上抜け / 下抜け の 4 種類。
// closes1y と当日 high/low から自動判定。各イベントは事実ベースのラベル文字列を返す。
export type LevelEvent = {
  type:
    | "52w-new-high"
    | "52w-new-low"
    | "ma200-cross-up"
    | "ma200-cross-down";
  label: string;
};

const MA200_LEN = 200;

function sma(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// closes1y / dayHigh / dayLow / fiftyTwoWeekHigh / fiftyTwoWeekLow から重要レベルイベントを抽出。
// データ不足時は空配列。複数同時起きる場合は配列で全部返す（呼び出し側で先頭 N 件を表示）。
export function detectLevelEvents(input: {
  closes1y?: readonly number[];
  dayHigh?: number;
  dayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}): LevelEvent[] {
  const out: LevelEvent[] = [];
  // 52 週新高値・新安値：当日高値が 52w 高値以上 / 当日安値が 52w 安値以下
  if (
    typeof input.dayHigh === "number" &&
    typeof input.fiftyTwoWeekHigh === "number" &&
    input.dayHigh >= input.fiftyTwoWeekHigh
  ) {
    out.push({ type: "52w-new-high", label: "🏔️ 52週新高値" });
  }
  if (
    typeof input.dayLow === "number" &&
    typeof input.fiftyTwoWeekLow === "number" &&
    input.dayLow <= input.fiftyTwoWeekLow &&
    input.fiftyTwoWeekLow > 0
  ) {
    out.push({ type: "52w-new-low", label: "📉 52週新安値" });
  }
  // 200 日線クロス：直近の close と前日 close を 200 日 SMA と比較。
  const closes = input.closes1y;
  if (closes && closes.length >= MA200_LEN + 1) {
    const last = closes[closes.length - 1];
    const prev = closes[closes.length - 2];
    const lastSma = sma(closes.slice(-MA200_LEN));
    const prevSma = sma(closes.slice(-MA200_LEN - 1, -1));
    if (
      typeof last === "number" &&
      typeof prev === "number" &&
      lastSma !== null &&
      prevSma !== null
    ) {
      if (last > lastSma && prev <= prevSma) {
        out.push({ type: "ma200-cross-up", label: "📈 200日線上抜け" });
      } else if (last < lastSma && prev >= prevSma) {
        out.push({ type: "ma200-cross-down", label: "📉 200日線下抜け" });
      }
    }
  }
  return out;
}

// 「N 日ぶり」マイルストーン検出：closes1y で当日値が直近 N 営業日の高値/安値に
// 一致しているかを判定し、最大の N（30/60/90/252）を返す。
// 例：当日が直近 30 日の最大 → "30 日ぶり高値"。
export type MilestoneEvent = {
  type: "n-day-high" | "n-day-low";
  days: number;
  label: string;
};

const MILESTONE_BUCKETS = [252, 90, 60, 30] as const;

export function detectMilestone(
  closes: readonly number[],
): MilestoneEvent | null {
  if (closes.length < 31) return null;
  const last = closes[closes.length - 1];
  if (typeof last !== "number") return null;
  for (const days of MILESTONE_BUCKETS) {
    if (closes.length <= days) continue;
    const window = closes.slice(-days - 1, -1); // 直前 N 日（自身を除く）
    const max = Math.max(...window);
    const min = Math.min(...window);
    if (last > max) {
      return {
        type: "n-day-high",
        days,
        label: days >= 252 ? "📅 1年ぶり高値" : `📅 ${days}日ぶり高値`,
      };
    }
    if (last < min) {
      return {
        type: "n-day-low",
        days,
        label: days >= 252 ? "📅 1年ぶり安値" : `📅 ${days}日ぶり安値`,
      };
    }
  }
  return null;
}

// パーセンタイル値を「上位/下位/中央寄り」の短文ラベルに変換。
// percentile null → 空文字（呼び出し側で非表示）。
export function percentileLabel(percentile: number | null): string {
  if (percentile === null) return "";
  if (percentile >= 90) return `過去1年で上位${(100 - percentile).toFixed(0)}%水準`;
  if (percentile >= 70) return `過去1年で上位${(100 - percentile).toFixed(0)}%`;
  if (percentile >= 30) return `過去1年で中央値付近`;
  if (percentile >= 10) return `過去1年で下位${percentile.toFixed(0)}%`;
  return `過去1年で下位${percentile.toFixed(0)}%水準`;
}
