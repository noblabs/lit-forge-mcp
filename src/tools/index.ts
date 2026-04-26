// 全ツールを集約してエクスポート。新しいツール追加時はここに 1 行足す。
//
// v0.2.0 で「金融・個人投資家特化」にピボット。旧 dev utility 10 ツールを廃止し、
// つみたて NISA・iDeCo を中心とした資産形成プランナー系 4 ツールに刷新。

import { simulateNisaTool } from "./simulate-nisa.js";
import { planRetirementTool } from "./plan-retirement.js";
import { calculateRequiredMonthlyTool } from "./calculate-required-monthly.js";
import { calculateCompoundInterestTool } from "./calculate-compound-interest.js";

export const tools = [
  simulateNisaTool,
  planRetirementTool,
  calculateRequiredMonthlyTool,
  calculateCompoundInterestTool,
];
