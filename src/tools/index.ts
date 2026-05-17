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
// v0.11.0 で get_economic_release_pulse を新設（BEA / 内閣府 / 日銀の 3 公式機関のリリース予定を実取得）。
// v0.12.0 で get_economic_release_pulse に NY 連銀 / FRB アダプタを追加（5 公式機関）。
// v0.13.0 で get_us_macro_latest を新設（BLS Public Data API v2 から雇用統計・失業率・CPI・PPI の 4 系列を取得）。BLS の HTML スケジュールは bot 403 で「発表予定」自動取得は断念し「最新値」取得に方針転換。
// v0.14.0 で White House OMB/OIRA の PFEI Schedule PDF を統合し BLS 三大指標の「発表予定」も自動取得対応（6 公式機関に）。同時に get_us_macro_latest を 4 → 7 系列に拡張（コア CPI / コア PPI / 平均時給を追加）。
// v0.14.1 で README / package.json keywords を 4 本柱（資産形成 + 市況 + 経済指標 + 地政学）に全面刷新、18 ツール表記に統一。
// v0.14.2 で description / keywords の追加整合。
// v0.14.3 で src/index.ts の version ハードコード撤廃 → package.json から動的読み込みに変更（以降の bump で自動同期）。server.json 側は手動同期。

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
  // v0.13.0 新規・v0.14.0 で 4→7 系列拡張: 米マクロ最新値（BLS Public Data API v2、雇用統計・失業率・CPI・コア CPI・PPI・コア PPI・平均時給）
  getUsMacroLatestTool,
];
