// 全ツールを集約してエクスポート。新しいツール追加時はここに 1 行足す。
//
// v0.2.0 で「金融・個人投資家特化」にピボット。旧 dev utility 10 ツールを廃止し、
// つみたて NISA・iDeCo を中心とした資産形成プランナー系 4 ツールに刷新。
// v0.3.0 で「毎朝の市況チェック」系 3 ツール（市況スナップショット・経済イベント・任意ティッカー取得）を追加。
// 初の HTTP fetch 導入（Yahoo Finance）— ローカル PC からインターネットに出ます。
// v0.4.0 で 5 ツール追加（温度計・ランキング・イールドスプレッド・市場時間・セクターヒートマップ）。
// 銘柄数 9 → 28 に拡大。

import { simulateNisaTool } from "./simulate-nisa.js";
import { planRetirementTool } from "./plan-retirement.js";
import { calculateRequiredMonthlyTool } from "./calculate-required-monthly.js";
import { calculateCompoundInterestTool } from "./calculate-compound-interest.js";
import { getMarketSnapshotTool } from "./get-market-snapshot.js";
import { getEconomicEventsTodayTool } from "./get-economic-events.js";
import { getQuoteTool } from "./get-quote.js";
import { getMarketThermometerTool } from "./get-market-thermometer.js";
import { getPerformanceRankingTool } from "./get-performance-ranking.js";
import { getYieldSpreadTool } from "./get-yield-spread.js";
import { getMarketSessionsTool } from "./get-market-sessions.js";
import { getSectorHeatmapTool } from "./get-sector-heatmap.js";

export const tools = [
  simulateNisaTool,
  planRetirementTool,
  calculateRequiredMonthlyTool,
  calculateCompoundInterestTool,
  getMarketSnapshotTool,
  getEconomicEventsTodayTool,
  getQuoteTool,
  // v0.4.0 新規ツール
  getMarketThermometerTool,
  getPerformanceRankingTool,
  getYieldSpreadTool,
  getMarketSessionsTool,
  getSectorHeatmapTool,
];
