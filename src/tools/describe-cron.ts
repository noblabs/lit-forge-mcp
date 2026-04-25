// cron 式を人間可読な日本語/英語に変換し、次回実行時刻も計算。

import cronstrue from "cronstrue/i18n.js";
import { CronExpressionParser } from "cron-parser";
import { z } from "zod";
import { errorReply, jsonReply, type LitForgeTool } from "./types.js";

const inputSchema = {
  expression: z.string().describe("cron 式（5 フィールド or 6 フィールド）"),
  locale: z
    .enum(["ja", "en"])
    .default("ja")
    .describe("人間可読説明の言語（ja / en）"),
  nextCount: z
    .number()
    .int()
    .min(0)
    .max(20)
    .default(5)
    .describe("計算する次回実行回数（0〜20）"),
  timezone: z
    .string()
    .default("UTC")
    .describe("タイムゾーン（IANA 形式、例: Asia/Tokyo）"),
};

export const describeCron: LitForgeTool = {
  name: "describe_cron",
  title: "cron 式の説明と次回実行時刻",
  description:
    "cron 式を人間可読な文章に変換し、指定タイムゾーンでの次回実行時刻を計算します。標準 5 フィールド・6 フィールド（秒つき）に対応。",
  inputSchema,
  handler: ({ expression, locale, nextCount, timezone }) => {
    let description: string;
    try {
      description = cronstrue.toString(expression as string, {
        locale: locale as string,
      });
    } catch (e) {
      return errorReply(
        `cron 式の解釈に失敗: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    const nextRuns: string[] = [];
    if (nextCount > 0) {
      try {
        const interval = CronExpressionParser.parse(expression, {
          tz: timezone,
        });
        for (let i = 0; i < nextCount; i++) {
          const iso = interval.next().toISOString();
          if (iso) nextRuns.push(iso);
        }
      } catch (e) {
        return errorReply(
          `次回実行時刻の計算に失敗: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    return jsonReply({
      expression,
      description,
      timezone,
      nextRuns,
    });
  },
};
