// 任意の Yahoo Finance ティッカーで単発の現在値・前日比を取得する。
// 9 主要指標以外（個別株・他通貨ペア・他コモディティ等）を確認したいケース用の拡張点。
// v0.6.0: includeFundamentals=true で PER/PBR/配当利回り/ベータ等のファンダメンタル指標も同時取得。

import { z } from "zod";
import { fetchFundamentals, fetchQuoteBySymbol } from "../lib/yahoo.js";
import { errorReply, jsonReply, type LitForgeTool } from "./types.js";

const inputSchema = {
  symbol: z
    .string()
    .min(1)
    .max(20)
    .describe(
      "Yahoo Finance ティッカー。例: AAPL（アップル株）/ ^DJI（NY ダウ）/ BTC-USD（ビットコイン）/ GBPJPY=X（ポンド円）",
    ),
  includeFundamentals: z
    .boolean()
    .optional()
    .describe(
      "true で PER / PBR / 配当利回り / ベータ / 時価総額 / 配当性向などのファンダメンタル指標も取得（個別株向け、指数や暗号資産では大半が空）。既定 false",
    ),
};

export const getQuoteTool: LitForgeTool = {
  name: "get_quote",
  title: "任意ティッカーの現在値取得",
  description:
    "Yahoo Finance の任意ティッカー（株・為替・指数・コモディティ・暗号資産）の現在値・前日比・スパークラインを取得します。get_market_snapshot で扱う 28 指標以外を確認したいときに使用。includeFundamentals=true で PER/PBR/配当利回り/ベータも取得（個別株向け）。投資助言ではありません。",
  inputSchema,
  handler: async ({ symbol, includeFundamentals }) => {
    try {
      const quote = await fetchQuoteBySymbol(symbol);
      // ファンダメンタルは並列で取得しない（quote 失敗時は早期 return したいため）。
      // ファンダメンタル取得失敗は無視して quote だけ返す（指数などで失敗するのが正常系）。
      let fundamentals;
      if (includeFundamentals) {
        try {
          fundamentals = await fetchFundamentals(symbol);
        } catch {
          // 指数・FX・暗号資産では quoteSummary 自体が失敗する。エラーにせず空の fundamentals を返す。
          fundamentals = undefined;
        }
      }
      return jsonReply({
        ...quote,
        ...(fundamentals ? { fundamentals } : {}),
        note: includeFundamentals
          ? "Yahoo Finance より取得（約 1 時間遅れ）。dividendYield は小数表記（0.0234 = 2.34%）。指数・FX・暗号資産ではファンダメンタル指標が欠損します。投資助言ではありません。"
          : "Yahoo Finance より取得（約 1 時間遅れ）。投資助言ではなく情報集約。",
      });
    } catch (e) {
      return errorReply(
        `${symbol} の取得に失敗しました: ${
          e instanceof Error ? e.message : "unknown"
        }。Yahoo Finance のティッカーが正しいか確認してください（例: AAPL / ^DJI / BTC-USD）`,
      );
    }
  },
};
