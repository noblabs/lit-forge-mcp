// 28 銘柄を 1d / 1w / 1m パフォーマンスでソートしたランキングを返す。
// 1w / 1m は 1y 履歴データを取得して PERFORMANCE_SYMBOLS の 7 銘柄について計算。

import { z } from "zod";
import { fetchHistorical, fetchSnapshot } from "../lib/yahoo.js";
import { INDICATORS } from "../lib/indicators.js";
import { rankByPerformance } from "../lib/rankings.js";
import { computePerformance, PERFORMANCE_SYMBOLS } from "../lib/performance.js";
import { errorReply, jsonReply, type LitForgeTool } from "./types.js";

const inputSchema = {
  period: z
    .enum(["1d", "1w", "1m"])
    .default("1d")
    .describe("ソート期間。1d=当日前日比、1w=直近5営業日、1m=直近21営業日"),
  topN: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(5)
    .describe("上位/下位 N 件を返す（デフォルト 5）"),
};

export const getPerformanceRankingTool: LitForgeTool = {
  name: "get_performance_ranking",
  title: "28 銘柄のパフォーマンスランキング",
  description:
    "28 銘柄（為替・株・金利・コモディティ・暗号資産）を指定期間のパフォーマンス降順で並べ、上位 N と下位 N を返します。1w/1m は主要 7 銘柄（USD/JPY・S&P 500・NASDAQ・NY ダウ・米10年金利・VIX・DXY）のみ対応。投資推奨ではなく数値ソートのみ。",
  inputSchema,
  handler: async (args: { period?: "1d" | "1w" | "1m"; topN?: number }) => {
    const period = args.period ?? "1d";
    const topN = args.topN ?? 5;
    try {
      const snapshot = await fetchSnapshot();
      // 1w / 1m の場合は performance フィールドを履歴から計算して埋める
      if (period !== "1d") {
        await Promise.all(
          PERFORMANCE_SYMBOLS.map(async (s) => {
            const q = snapshot.quotes[s];
            if (!q || "error" in q) return;
            try {
              const closes = await fetchHistorical(s);
              if (closes.length > 0) {
                q.closes1y = closes;
                q.performance = computePerformance(closes);
              }
            } catch {
              // best-effort
            }
          }),
        );
      }
      const ranked = rankByPerformance(INDICATORS, snapshot.quotes, period);
      return jsonReply({
        period,
        total: ranked.length,
        top: ranked.slice(0, topN).map((r) => ({
          symbol: r.indicator.symbol,
          displayName: r.indicator.displayName,
          changePercent: r.pct,
        })),
        bottom: ranked
          .slice(-topN)
          .reverse()
          .map((r) => ({
            symbol: r.indicator.symbol,
            displayName: r.indicator.displayName,
            changePercent: r.pct,
          })),
        note: "パフォーマンス順は数値ソートのみ。順位は投資判断の根拠ではありません。",
      });
    } catch (e) {
      return errorReply(
        `ランキング計算に失敗しました: ${e instanceof Error ? e.message : "unknown"}`,
      );
    }
  },
};
