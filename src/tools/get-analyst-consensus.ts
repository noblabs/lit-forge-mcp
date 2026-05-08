// 個別株のアナリストコンセンサス（推奨レーティング・目標株価）を取得する（v0.6.0）。
// 米国株は coverage が厚いが、TSE 銘柄や ETF は数値が薄い / 欠損する。
// 投資助言ではなく「複数アナリスト平均」の単なる集約値である点を note で明示する。

import { z } from "zod";
import { fetchAnalystConsensus } from "../lib/yahoo.js";
import { errorReply, jsonReply, type LitForgeTool } from "./types.js";

const inputSchema = {
  symbol: z
    .string()
    .min(1)
    .max(20)
    .describe(
      "Yahoo Finance ティッカー。例: NVDA / AAPL / 7203.T（トヨタ）。指数や暗号資産は対象外",
    ),
};

export const getAnalystConsensusTool: LitForgeTool = {
  name: "get_analyst_consensus",
  title: "アナリストコンセンサスの取得",
  description:
    "個別株のアナリスト推奨レーティング（強気買い～強気売り）・目標株価（平均/高値/安値）・月別推奨内訳を取得します（Yahoo Finance）。米国株は coverage が厚く、日本株や ETF は欠損しやすい。投資助言ではなく集約値です。",
  inputSchema,
  handler: async ({ symbol }) => {
    try {
      const consensus = await fetchAnalystConsensus(symbol);
      const opinions = consensus.numberOfAnalystOpinions ?? 0;

      const note =
        opinions === 0
          ? `${symbol} はアナリスト coverage が見つかりません。日本株（東証）・ETF・指数・暗号資産では取得できないことが多い。投資助言ではありません。`
          : `Yahoo Finance より取得。アナリスト ${opinions} 名のコンセンサス。recommendationMean は 1.0 (強気買い) ～ 5.0 (強気売り) のスケール。投資助言ではありません。`;

      return jsonReply({
        symbol,
        ...consensus,
        note,
      });
    } catch (e) {
      return errorReply(
        `${symbol} のアナリストコンセンサス取得に失敗しました: ${
          e instanceof Error ? e.message : "unknown"
        }。Yahoo Finance のティッカーが正しいか確認してください（例: NVDA / AAPL）`,
      );
    }
  },
};
