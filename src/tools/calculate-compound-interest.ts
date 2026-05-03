// 一般複利計算: 元本（一括）＋月次積立 を月次複利で評価。
// NISA に限らず、定期預金 / 投資信託 / 任意の積立計算に使える。

import { z } from "zod";
import { combinedFutureValue } from "../lib/nisa.js";
import { jsonReply, type LitForgeTool } from "./types.js";

const inputSchema = {
  principal: z
    .number()
    .min(0)
    .default(0)
    .describe("一括投入する元本（円）。例: 1000000"),
  monthlyContribution: z
    .number()
    .min(0)
    .default(0)
    .describe("毎月の積立額（円）。一括だけなら 0"),
  annualRate: z
    .number()
    .min(0)
    .max(100)
    .describe("想定年利（%表記。例: 3 = 3%/年）"),
  years: z
    .number()
    .min(0)
    .max(60)
    .describe("運用年数（小数可。例: 0.5 = 半年、10.5 = 10年6ヶ月）"),
};

export const calculateCompoundInterestTool: LitForgeTool = {
  name: "calculate_compound_interest",
  title: "複利計算（一括 + 月次積立）",
  description:
    "元本（一括）と毎月の積立額を、月次複利で運用したときの将来価値を計算します。NISA に限らず一般の投資・定期預金シミュに使える汎用ツール。",
  inputSchema,
  handler: ({ principal, monthlyContribution, annualRate, years }) => {
    const monthlyRate = annualRate / 100 / 12;
    const months = years * 12;
    const futureValue = combinedFutureValue(
      principal,
      monthlyContribution,
      monthlyRate,
      months,
    );
    const totalContribution = principal + monthlyContribution * months;
    const profit = futureValue - totalContribution;
    return jsonReply({
      futureValue: Math.round(futureValue),
      principal,
      totalMonthlyContribution: Math.round(monthlyContribution * months),
      totalContribution: Math.round(totalContribution),
      profit: Math.round(profit),
      annualRate,
      years,
      note: "月次複利。税金・手数料は考慮せず。投資判断は自己責任で。",
    });
  },
};
