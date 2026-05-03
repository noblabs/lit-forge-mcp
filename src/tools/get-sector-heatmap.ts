// 米株セクター ETF（SPDR、11 銘柄）の前日比ヒートマップを返す。
// AI が「今日はテクノロジーが強い」「金融は弱い」のようなセクターローテーション情報を取得可能に。

import { fetchSubsetSnapshot } from "../lib/yahoo.js";
import { SECTOR_ETFS, SECTOR_SYMBOLS } from "../lib/sectors.js";
import { errorReply, jsonReply, type LitForgeTool } from "./types.js";

export const getSectorHeatmapTool: LitForgeTool = {
  name: "get_sector_heatmap",
  title: "米株セクター ETF 前日比ヒートマップ（SPDR、11 セクター）",
  description:
    "米株セクター ETF（テクノロジー XLK / 金融 XLF / ヘルスケア XLV / 一般消費財 XLY / 生活必需品 XLP / エネルギー XLE / 資本財 XLI / 公益 XLU / 素材 XLB / 不動産 XLRE / 通信 XLC）の現在値と前日比を一括取得。米株市場のセクターローテーションを把握する情報源。",
  inputSchema: {},
  handler: async () => {
    try {
      const quotes = await fetchSubsetSnapshot(SECTOR_SYMBOLS);
      const sectors = SECTOR_ETFS.map((s) => {
        const q = quotes[s.symbol];
        return {
          symbol: s.symbol,
          name: s.name,
          description: s.description,
          quote: q,
        };
      });
      return jsonReply({
        fetchedAt: new Date().toISOString(),
        sectors,
        note: "Yahoo Finance より取得（約 1 時間遅れ）。投資推奨ではありません。",
      });
    } catch (e) {
      return errorReply(
        `セクター取得に失敗しました: ${e instanceof Error ? e.message : "unknown"}`,
      );
    }
  },
};
