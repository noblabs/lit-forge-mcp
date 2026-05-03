// マーケット温度計：VIX / S&P 500 / 米10年金利 / DXY を合成した 0-100 のリスクオン/オフ・スコア。
// /today ページのページ最上部に出ているのと同じ合成ロジック。事実ベースで投資推奨を含まない。

import { fetchSnapshot, fetchHistorical } from "../lib/yahoo.js";
import {
  computeThermometer,
  computeThermometerHistory,
} from "../lib/thermometer.js";
import { errorReply, jsonReply, type LitForgeTool } from "./types.js";

const HIST_SYMBOLS = ["^VIX", "^GSPC", "^TNX", "DX-Y.NYB"];

export const getMarketThermometerTool: LitForgeTool = {
  name: "get_market_thermometer",
  title: "マーケット温度計（リスクオン/オフ合成スコア）",
  description:
    "VIX・S&P 500 前日比・米10年金利前日比・ドル指数前日比を合成した 0-100 のリスクオン/オフ・スコアを返します。50 が中立、70 以上でリスクオン優勢、30 以下でリスクオフ優勢。各成分のスコアと過去 30 営業日の推移も含みます。投資推奨ではなく俯瞰用の指標です。",
  inputSchema: {},
  handler: async () => {
    try {
      const snapshot = await fetchSnapshot();
      // 履歴算出のため historical を取得して closes1y を補完
      await Promise.all(
        HIST_SYMBOLS.map(async (s) => {
          const q = snapshot.quotes[s];
          if (!q || "error" in q) return;
          try {
            const closes = await fetchHistorical(s);
            if (closes.length > 0) q.closes1y = closes;
          } catch {
            // 履歴取得は best-effort
          }
        }),
      );
      const result = computeThermometer(snapshot);
      const history = computeThermometerHistory(snapshot, 30);
      if (!result) {
        return errorReply(
          "温度計の合成に必要な銘柄（VIX / S&P 500 / 米10年金利 / DXY）の取得に失敗しました。",
        );
      }
      return jsonReply({
        score: result.score,
        level: result.level,
        components: result.components,
        history30d: history,
        note: "VIX 低・S&P 上・米10年上・DXY 下を「リスクオン寄り」とする素朴な合成。投資助言ではありません。",
      });
    } catch (e) {
      return errorReply(
        `温度計の計算に失敗しました: ${e instanceof Error ? e.message : "unknown"}`,
      );
    }
  },
};
