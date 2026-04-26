// つみたて NISA / iDeCo の単純シミュレーション。
// 毎月一定額を積み立てる年金型として、月次複利で将来評価額を求める。

import { z } from "zod";
import { simulateNisa } from "../lib/nisa.js";
import { errorReply, jsonReply, type LitForgeTool } from "./types.js";

const inputSchema = {
  monthly: z
    .number()
    .min(0)
    .describe("毎月の積立額（円）。例: 30000"),
  annualRate: z
    .number()
    .min(0)
    .max(100)
    .describe("想定年利（%表記。例: 5 = 5%/年）"),
  years: z
    .number()
    .int()
    .min(0)
    .max(60)
    .describe("積立年数（0〜60）"),
};

export const simulateNisaTool: LitForgeTool = {
  name: "simulate_nisa",
  title: "つみたて NISA シミュレーション",
  description:
    "毎月の積立額・想定年利・年数から、月次複利で将来評価額・運用益・年次推移を試算します。NISA / iDeCo の単純シミュレーション用。",
  inputSchema,
  handler: ({ monthly, annualRate, years }) => {
    const result = simulateNisa({ monthly, annualRate, years });
    if (!result) return errorReply("入力が不正です（負値・NaN・Infinity は不可）");
    return jsonReply({
      totalContribution: result.totalContribution,
      finalValue: result.finalValue,
      profit: result.profit,
      yearly: result.yearly,
      note: "月次複利の積立年金（annuity-immediate）として算出。税金・手数料は考慮せず。投資判断は自己責任で。",
    });
  },
};
