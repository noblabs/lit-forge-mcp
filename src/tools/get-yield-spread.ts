// 米10年-5年イールドスプレッド（^TNX - ^FVX）を返す。
// 順イールドの傾き、フラット化、逆イールドの判定を AI に渡せる事実情報として提供。

import { fetchQuoteForIndicator } from "../lib/yahoo.js";
import { computeYieldSpread } from "../lib/yield-spread.js";
import { INDICATORS } from "../lib/indicators.js";
import type { Snapshot } from "../lib/market-types.js";
import { errorReply, jsonReply, type LitForgeTool } from "./types.js";

export const getYieldSpreadTool: LitForgeTool = {
  name: "get_yield_spread",
  title: "米イールドスプレッド（10y-5y）",
  description:
    "米10年債利回り（^TNX）と米5年債利回り（^FVX）の差（イールドスプレッド）を返します。プラスは順イールド、マイナスは逆イールド。前日比 bp も含む。投資判断の参考情報。",
  inputSchema: {},
  handler: async () => {
    try {
      const tnx = INDICATORS.find((i) => i.symbol === "^TNX")!;
      const fvx = INDICATORS.find((i) => i.symbol === "^FVX")!;
      const [tnxRes, fvxRes] = await Promise.all([
        fetchQuoteForIndicator(tnx),
        fetchQuoteForIndicator(fvx),
      ]);
      const snapshot: Snapshot = {
        fetchedAt: new Date().toISOString(),
        quotes: { "^TNX": tnxRes, "^FVX": fvxRes },
      };
      const spread = computeYieldSpread(snapshot);
      if (!spread) {
        return errorReply(
          "米10年金利または米5年金利の取得に失敗しました。",
        );
      }
      return jsonReply({
        spread: spread.spread,
        spreadChangeBp: spread.spreadChangeBp,
        tnx: tnxRes,
        fvx: fvxRes,
        note: "プラスは順イールド、マイナスは逆イールド。投資推奨ではなく参考情報。",
      });
    } catch (e) {
      return errorReply(
        `イールドスプレッド計算に失敗しました: ${e instanceof Error ? e.message : "unknown"}`,
      );
    }
  },
};
