// 任意の Yahoo Finance ティッカーで単発の現在値・前日比を取得する。
// 9 主要指標以外（個別株・他通貨ペア・他コモディティ等）を確認したいケース用の拡張点。

import { z } from "zod";
import { fetchQuoteBySymbol } from "../lib/yahoo.js";
import { errorReply, jsonReply, type LitForgeTool } from "./types.js";

const inputSchema = {
  symbol: z
    .string()
    .min(1)
    .max(20)
    .describe(
      "Yahoo Finance ティッカー。例: AAPL（アップル株）/ ^DJI（NY ダウ）/ BTC-USD（ビットコイン）/ GBPJPY=X（ポンド円）",
    ),
};

export const getQuoteTool: LitForgeTool = {
  name: "get_quote",
  title: "任意ティッカーの現在値取得",
  description:
    "Yahoo Finance の任意ティッカー（株・為替・指数・コモディティ・暗号資産）の現在値・前日比・スパークラインを取得します。get_market_snapshot で扱う 9 指標以外を確認したいときに使用。投資助言ではありません。",
  inputSchema,
  handler: async ({ symbol }) => {
    try {
      const quote = await fetchQuoteBySymbol(symbol);
      return jsonReply({
        ...quote,
        note: "Yahoo Finance より取得（約 1 時間遅れ）。投資助言ではなく情報集約。",
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
