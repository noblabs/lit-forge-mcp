// 個人資産形成プランナー：年齢・貯蓄・希望生活費から
// 楽観/現実/悲観 3 シナリオ + 老後資金充足度 + 必要月額逆算を返す。

import { z } from "zod";
import { planRetirement } from "../lib/nisa.js";
import { errorReply, jsonReply, type LitForgeTool } from "./types.js";

const inputSchema = {
  age: z.number().int().min(0).max(120).describe("現在の年齢"),
  currentSavings: z
    .number()
    .min(0)
    .default(0)
    .describe("現在の投資資産（円。預金 + 投資商品の合計）"),
  monthlyContribution: z
    .number()
    .min(0)
    .describe("毎月の積立額（円）"),
  retirementAge: z
    .number()
    .int()
    .min(0)
    .max(120)
    .describe("退職（積立終了）予定年齢"),
  monthlyRetirementSpend: z
    .number()
    .min(0)
    .describe("退職後の月間希望生活費（円）"),
  riskTolerance: z
    .enum(["conservative", "balanced", "aggressive"])
    .default("balanced")
    .describe(
      "リスク許容度。conservative=1-5%, balanced=2-6%, aggressive=3-8% の年利想定",
    ),
  pensionMonthly: z
    .number()
    .min(0)
    .default(145_000)
    .describe(
      "受給予定の公的年金月額（円）。デフォルト 145,000 は厚生年金の標準値",
    ),
  lifeExpectancy: z
    .number()
    .int()
    .min(0)
    .max(120)
    .default(85)
    .describe("想定寿命（年）。日本人平均は 84 前後"),
};

export const planRetirementTool: LitForgeTool = {
  name: "plan_retirement",
  title: "個人資産形成プランナー（NISA / iDeCo）",
  description:
    "年齢・現在の貯蓄・毎月の積立額・退職予定年齢・退職後の希望生活費・リスク許容度・受給年金から、楽観/現実/悲観 3 シナリオで将来資産と老後資金の充足度を試算。不足する場合は現実シナリオで届く必要月額も自動逆算します。",
  inputSchema,
  handler: (args) => {
    const result = planRetirement(args);
    if (!result) {
      return errorReply(
        "入力が不正です。retirementAge > age, lifeExpectancy > retirementAge, 全項目 0 以上の有限値である必要があります",
      );
    }
    return jsonReply({
      ...result,
      note: "月次複利による参考値。税金（NISA枠超過の譲渡益課税・iDeCo 所得控除等）は別途計算が必要。投資判断は自己責任で。年金額は「ねんきんネット」で正確値を確認推奨。",
    });
  },
};
