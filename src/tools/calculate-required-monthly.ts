// 目標金額に達するための必要月額を逆算。
// 一括（現在の貯蓄）の運用と月次積立の組み合わせで月次複利。

import { z } from "zod";
import { combinedFutureValue } from "../lib/nisa.js";
import { errorReply, jsonReply, type LitForgeTool } from "./types.js";

const inputSchema = {
  targetAmount: z
    .number()
    .min(0)
    .describe("達成したい目標金額（円）。例: 20000000"),
  currentSavings: z
    .number()
    .min(0)
    .default(0)
    .describe("現在の投資資産（円。複利運用される）"),
  annualRate: z
    .number()
    .min(0)
    .max(100)
    .describe("想定年利（%表記）"),
  years: z
    .number()
    .int()
    .min(1)
    .max(60)
    .describe("積立期間（年）"),
};

// 数値 (整数 円) で返す。target に届かない（年利低 + 期間短 + 一括少）場合 null。
function solveMonthlyForTarget(
  target: number,
  currentSavings: number,
  annualRate: number,
  years: number,
): number | null {
  if (years <= 0) return null;
  const monthlyRate = annualRate / 100 / 12;
  const months = years * 12;
  // 一括運用分の将来価値
  const lumpFV = monthlyRate === 0
    ? currentSavings
    : currentSavings * Math.pow(1 + monthlyRate, months);
  if (lumpFV >= target) return 0;
  const remaining = target - lumpFV;
  const annuityFactor = monthlyRate === 0
    ? months
    : (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
  if (annuityFactor <= 0) return null;
  return Math.ceil(remaining / annuityFactor);
}

export const calculateRequiredMonthlyTool: LitForgeTool = {
  name: "calculate_required_monthly",
  title: "必要月額逆算",
  description:
    "目標金額・現在の貯蓄・想定年利・積立期間から、目標達成に必要な毎月の積立額を逆算します。「N 年後に X 円作るには月いくら積み立てればよいか」の問いに答えるツール。",
  inputSchema,
  handler: ({ targetAmount, currentSavings, annualRate, years }) => {
    const required = solveMonthlyForTarget(
      targetAmount,
      currentSavings,
      annualRate,
      years,
    );
    if (required === null) {
      return errorReply(
        "計算できませんでした（years が 0 以下か、入力が不正の可能性）",
      );
    }
    // 検算: その月額で実際に届くか
    const monthlyRate = annualRate / 100 / 12;
    const projectedFinal = combinedFutureValue(
      currentSavings,
      required,
      monthlyRate,
      years * 12,
    );
    return jsonReply({
      requiredMonthly: required,
      targetAmount,
      currentSavings,
      annualRate,
      years,
      projectedFinal: Math.round(projectedFinal),
      note:
        required === 0
          ? "現在の貯蓄を年利通り運用するだけで目標達成可能（月次積立 0 円で OK）"
          : "月次複利による参考値。税金・手数料は考慮せず。投資判断は自己責任で。",
    });
  },
};
