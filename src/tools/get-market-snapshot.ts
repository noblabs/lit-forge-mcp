// 主要マクロ指標 9 銘柄（為替・株・金利・コモディティ）の現在値・前日比を一括取得。
// /today ページと同等情報を Claude Desktop / Cursor から呼べる。

import { fetchSnapshot } from "../lib/yahoo.js";
import { errorReply, jsonReply, type LitForgeTool } from "./types.js";

export const getMarketSnapshotTool: LitForgeTool = {
  name: "get_market_snapshot",
  title: "主要マクロ指標スナップショット",
  description:
    "USD/JPY・EUR/JPY・日経平均・TOPIX・S&P 500・NASDAQ 100・米10年債利回り・金・原油 WTI の現在値と前日比を Yahoo Finance から取得します。lit-forge.com/today と同等の情報。約 1 時間遅れの参考値で、投資助言ではありません。",
  inputSchema: {},
  handler: async () => {
    try {
      const snapshot = await fetchSnapshot();
      const successCount = snapshot.quotes.filter((q) => !("error" in q)).length;
      return jsonReply({
        fetchedAt: snapshot.fetchedAt,
        successCount,
        totalCount: snapshot.quotes.length,
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
