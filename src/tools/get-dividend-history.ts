// 個別株の配当履歴を取得する（v0.6.0）。
// 直近 N 年分の配当明細 + 暦年ごとの合計を返す。配当ゼロ銘柄（GOOG / 多くの IT 系）は空配列。
// NISA 成長投資枠で配当銘柄を検討する一次情報として使う想定。

import { z } from "zod";
import {
  aggregateDividendsByYear,
  fetchDividendHistory,
  fetchFundamentals,
} from "../lib/yahoo.js";
import { errorReply, jsonReply, type LitForgeTool } from "./types.js";

const inputSchema = {
  symbol: z
    .string()
    .min(1)
    .max(20)
    .describe(
      "Yahoo Finance ティッカー。例: KO（コカ・コーラ）/ JNJ（J&J）/ 8306.T（三菱 UFJ）/ VYM（高配当 ETF）",
    ),
  years: z
    .union([z.literal(1), z.literal(3), z.literal(5), z.literal(10)])
    .optional()
    .describe("取得する年数。1 / 3 / 5 / 10 のいずれか。既定 5"),
};

export const getDividendHistoryTool: LitForgeTool = {
  name: "get_dividend_history",
  title: "配当履歴の取得",
  description:
    "個別株または ETF の過去 N 年の配当履歴と暦年ごとの合計を取得します（Yahoo Finance）。NISA 成長投資枠で配当銘柄を検討する際の一次情報として使用。配当ゼロ銘柄は dividends が空配列で返ります。投資助言ではありません。",
  inputSchema,
  handler: async ({ symbol, years }) => {
    const range = (years ?? 5) as 1 | 3 | 5 | 10;
    try {
      // 配当履歴と現在の dividendYield / payoutRatio を並列取得。
      // fundamentals は失敗してもツールは成立するので Promise.allSettled で吸収。
      const [divResult, fundResult] = await Promise.allSettled([
        fetchDividendHistory(symbol, range),
        fetchFundamentals(symbol),
      ]);

      if (divResult.status === "rejected") {
        const msg =
          divResult.reason instanceof Error
            ? divResult.reason.message
            : "unknown";
        return errorReply(
          `${symbol} の配当履歴取得に失敗しました: ${msg}。Yahoo Finance のティッカーが正しいか確認してください（例: KO / JNJ / 8306.T）`,
        );
      }

      const dividends = divResult.value;
      const totalByYear = aggregateDividendsByYear(dividends);

      const fundamentals =
        fundResult.status === "fulfilled" ? fundResult.value : undefined;

      const note =
        dividends.length === 0
          ? `配当ゼロまたは過去 ${range} 年に配当実績なし。GOOG など多くの IT 系企業は配当を出しません。投資助言ではありません。`
          : `Yahoo Finance より取得。dividendYield は現在値ベースの実績利回り（小数表記、0.0234 = 2.34%）。投資助言ではありません。`;

      return jsonReply({
        symbol,
        years: range,
        dividends,
        totalByYear,
        currentYield: fundamentals?.dividendYield,
        payoutRatio: fundamentals?.payoutRatio,
        note,
      });
    } catch (e) {
      return errorReply(
        `${symbol} の配当履歴取得に失敗しました: ${
          e instanceof Error ? e.message : "unknown"
        }`,
      );
    }
  },
};
