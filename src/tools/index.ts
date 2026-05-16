// 全ツールを集約してエクスポート。新しいツール追加時はここに 1 行足す。
//
// v0.2.0 で「金融・個人投資家特化」にピボット。旧 dev utility 10 ツールを廃止し、
// つみたて NISA・iDeCo を中心とした資産形成プランナー系 4 ツールに刷新。
// v0.3.0 で「毎朝の市況チェック」系 3 ツール（市況スナップショット・経済イベント・任意ティッカー取得）を追加。
// 初の HTTP fetch 導入（Yahoo Finance）— ローカル PC からインターネットに出ます。
// v0.4.0 で 5 ツール追加（温度計・ランキング・イールドスプレッド・市場時間・セクターヒートマップ）。
// 銘柄数 9 → 28 に拡大。
// v0.6.0 で 2 ツール追加（配当履歴・アナリストコンセンサス）+ get_quote にファンダメンタル指標オプション。
// v0.8.0 で地政学イベント専用ツール get_geopolitical_events を追加（首脳会談・サミット・選挙・地政学リスクの 4 サブカテゴリ）。
// v0.9.0 で地政学ツールを 2 系統に分離: get_geopolitical_calendar（確定スケジュール、旧 events からリネーム）+ get_geopolitical_pulse（リアルタイム速報、RSS アグリゲーション）。
// 設計詳細は docs/geopolitical-realtime.md 参照。

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
import { getDividendHistoryTool } from "./get-dividend-history.js";
import { getAnalystConsensusTool } from "./get-analyst-consensus.js";
import { getGeopoliticalCalendarTool } from "./get-geopolitical-calendar.js";
import { getGeopoliticalPulseTool } from "./get-geopolitical-pulse.js";
import { getEconomicReleasePulseTool } from "./get-economic-release-pulse.js";
import { getUsMacroLatestTool } from "./get-us-macro-latest.js";

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
  // v0.6.0 新規ツール
  getDividendHistoryTool,
  getAnalystConsensusTool,
  // v0.9.0 新規 / リネーム: 地政学カレンダー（旧 get_geopolitical_events）+ リアルタイム速報
  getGeopoliticalCalendarTool,
  getGeopoliticalPulseTool,
  // v0.11.0 新規: 経済指標リリース予定の公式機関カレンダー リアルタイム取得（手動キュレーションの網羅性補完）
  getEconomicReleasePulseTool,
  // v0.13.0 新規: 米マクロ最新値（BLS Public Data API、雇用統計・失業率・CPI・PPI）
  getUsMacroLatestTool,
];
