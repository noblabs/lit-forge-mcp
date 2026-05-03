// マーケット温度計：複数指標を組み合わせて 0〜100 のリスクオン/オフ合成スコアを返す。
// 数値の意味は「リスクオン度」(=積極的にリスク資産が買われている度合い)。
// 高い (>= 70) → リスクオン優勢、低い (<= 30) → リスクオフ優勢、中間 → 中立。
//
// あくまで個々の指標の現在値を線形マッピングして平均する素朴な合成で、
// 「これを根拠に売買せよ」という投資シグナルではない（YMYL 配慮）。
// 算出式・ラベルは事実ベースに留め、UI 側でも「投資助言ではなく俯瞰用」と明示する。

import type { Quote, QuoteResult, Snapshot } from "./market-types.js";

// 個別コンポーネントの寄与スコア（0〜100）。null は欠損。
export type ThermometerComponent = {
  label: string;
  value: number | null;
  // この指標が「リスクオン寄り」と読まれるレンジ（説明文用）。
  bias: string;
};

export type ThermometerResult = {
  score: number; // 0..100、コンポーネント平均
  level: "risk-on" | "neutral" | "risk-off";
  components: ThermometerComponent[];
};

// 値を 0..100 にクリップ
function clamp01(x: number): number {
  return Math.max(0, Math.min(100, x));
}

function getQuote(snapshot: Snapshot, symbol: string): Quote | null {
  const q: QuoteResult | undefined = snapshot.quotes[symbol];
  if (!q || "error" in q) return null;
  return q;
}

// VIX：低いほどリスクオン。10 → 100、30 → 0 で線形マッピング。
// （20 が中立 50 になるよう設計）
function vixScore(snapshot: Snapshot): number | null {
  const q = getQuote(snapshot, "^VIX");
  if (!q) return null;
  const v = q.price;
  return clamp01(((30 - v) / 20) * 100);
}

// S&P 500 前日比：+1.5% で 100、-1.5% で 0、0% で 50。
function spxScore(snapshot: Snapshot): number | null {
  const q = getQuote(snapshot, "^GSPC");
  if (!q) return null;
  return clamp01(((q.changePercent + 1.5) / 3) * 100);
}

// 米10年金利：金利上昇 = リスクオン側に振れることが多い（景気期待）が、過熱で逆相関にもなる。
// ここでは前日比 bp で評価：+10bp で 100、-10bp で 0、0bp で 50。
function tnxScore(snapshot: Snapshot): number | null {
  const q = getQuote(snapshot, "^TNX");
  if (!q) return null;
  return clamp01(((q.changeBp + 10) / 20) * 100);
}

// ドル指数 DXY：上昇は一般にリスクオフ（質への逃避）。前日比 -0.5% で 100、+0.5% で 0、0% で 50。
function dxyScore(snapshot: Snapshot): number | null {
  const q = getQuote(snapshot, "DX-Y.NYB");
  if (!q) return null;
  return clamp01(((-q.changePercent + 0.5) / 1) * 100);
}

// /today 上部に出すマーケット温度計の合成スコアを返す。
// 取得できた成分の平均で算出する（欠損成分は無視）。全成分欠損なら null。
export function computeThermometer(snapshot: Snapshot): ThermometerResult | null {
  const components: ThermometerComponent[] = [
    { label: "VIX (株式ボラ)", value: vixScore(snapshot), bias: "低いほどリスクオン" },
    { label: "S&P 500 前日比", value: spxScore(snapshot), bias: "上昇でリスクオン" },
    { label: "米10年金利前日比", value: tnxScore(snapshot), bias: "上昇でリスクオン寄り" },
    { label: "ドル指数前日比", value: dxyScore(snapshot), bias: "下落でリスクオン" },
  ];
  const valid = components
    .map((c) => c.value)
    .filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  const score = valid.reduce((a, b) => a + b, 0) / valid.length;
  const level: ThermometerResult["level"] =
    score >= 70 ? "risk-on" : score <= 30 ? "risk-off" : "neutral";
  return { score, level, components };
}

// 任意の VIX 価格 / SPX・DXY 前日比% / TNX bp から合成スコアを計算（履歴算出用）。
function scoreFromValues(
  vixPrice: number | null,
  spxPct: number | null,
  tnxBp: number | null,
  dxyPct: number | null,
): number | null {
  const parts: number[] = [];
  if (typeof vixPrice === "number") parts.push(clamp01(((30 - vixPrice) / 20) * 100));
  if (typeof spxPct === "number") parts.push(clamp01(((spxPct + 1.5) / 3) * 100));
  if (typeof tnxBp === "number") parts.push(clamp01(((tnxBp + 10) / 20) * 100));
  if (typeof dxyPct === "number") parts.push(clamp01(((-dxyPct + 0.5) / 1) * 100));
  if (parts.length === 0) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

// 過去 N 日の温度計合成スコアを日足配列から逆算する。
// closes1y を持つ 4 銘柄（^VIX, ^GSPC, ^TNX, DX-Y.NYB）の close 配列を入力に取り、
// 各日 i について closes[i] と closes[i-1] から prev-day 比を計算してスコア化。
// 戻り値は末尾が「最新日」、長さは days （データ点不足は number[] が短くなる）。
export function computeThermometerHistory(
  snapshot: Snapshot,
  days = 30,
): number[] {
  const get1y = (symbol: string): number[] | null => {
    const q = snapshot.quotes[symbol];
    if (!q || "error" in q) return null;
    return q.closes1y && q.closes1y.length > 1 ? q.closes1y : null;
  };
  const vix = get1y("^VIX");
  const spx = get1y("^GSPC");
  const tnx = get1y("^TNX");
  const dxy = get1y("DX-Y.NYB");
  // 共通する有効長を取る（最も短い配列に合わせる、ただし null は無視）
  const lens = [vix, spx, tnx, dxy]
    .filter((a): a is number[] => a !== null)
    .map((a) => a.length);
  if (lens.length === 0) return [];
  const minLen = Math.min(...lens);
  // i=1 から minLen-1 までスコア化（i=0 は前日が無い）
  const start = Math.max(1, minLen - days);
  const out: number[] = [];
  for (let i = start; i < minLen; i++) {
    const vixPrice = vix ? vix[i] : null;
    const spxPct =
      spx && spx[i - 1] !== 0 ? ((spx[i] - spx[i - 1]) / spx[i - 1]) * 100 : null;
    const tnxBp = tnx ? (tnx[i] - tnx[i - 1]) * 100 : null;
    const dxyPct =
      dxy && dxy[i - 1] !== 0 ? ((dxy[i] - dxy[i - 1]) / dxy[i - 1]) * 100 : null;
    const s = scoreFromValues(vixPrice, spxPct, tnxBp, dxyPct);
    if (s !== null) out.push(s);
  }
  return out;
}
