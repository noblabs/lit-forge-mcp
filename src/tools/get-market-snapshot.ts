// 主要マクロ指標 28 銘柄（為替・株・金利・コモディティ・暗号資産）の現在値・前日比を一括取得。
// /today ページと同等情報を Claude Desktop / Cursor から呼べる。
// v0.4 で 9 → 28 銘柄に拡張、出力形式は Record<symbol, QuoteResult>。

import { fetchSnapshot } from "../lib/yahoo.js";
import { errorReply, jsonReply, type LitForgeTool } from "./types.js";

export const getMarketSnapshotTool: LitForgeTool = {
  name: "get_market_snapshot",
  title: "主要マクロ指標スナップショット",
  description:
    "USD/JPY・EUR/JPY・GBP/JPY・AUD/JPY・EUR/USD・CHF/JPY・ドル指数・日経平均・TOPIX・NY ダウ・S&P 500・NASDAQ・VIX・NYSE FANG+・SOX・DAX・FTSE・上海総合・ハンセン・KOSPI・SENSEX・米10年/5年金利・金・原油・銅・ビットコイン・イーサリアム の主要 28 指標の現在値と前日比を Yahoo Finance から取得します。lit-forge.com/today と同等の情報。約 1 時間遅れの参考値で、投資助言ではありません。",
  inputSchema: {},
  handler: async () => {
    try {
      const snapshot = await fetchSnapshot();
      const entries = Object.entries(snapshot.quotes);
      const successCount = entries.filter(
        ([, q]) => !("error" in q),
      ).length;
      return jsonReply({
        fetchedAt: snapshot.fetchedAt,
        successCount,
        totalCount: entries.length,
        quotes: snapshot.quotes,
        note: "データは Yahoo Finance より取得（約 1 時間遅れ）。投資助言ではなく情報集約。",
      });
    } catch (e) {
      return errorReply(
        `Yahoo Finance API への接続に失敗しました: ${
          e instanceof Error ? e.message : "unknown"
        }`,
      );
    }
  },
};
