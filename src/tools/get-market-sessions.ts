// 主要市場（東京・上海・ロンドン・NY）の現在の取引時間ステータスを返す。
// AI が「今は NY が動いている時間」「東京はもうすぐオープン」のような時間軸の context を取れる。

import { getSessionStatuses } from "../lib/sessions.js";
import { jsonReply, type LitForgeTool } from "./types.js";

export const getMarketSessionsTool: LitForgeTool = {
  name: "get_market_sessions",
  title: "主要市場の取引時間ステータス",
  description:
    "東京（9:00-15:30 JST）/ 上海（10:30-16:00 JST）/ ロンドン（17:00-25:30 JST）/ NY（22:30-29:00 JST）の現在の取引時間ステータス（open / pre-open / closed）を返します。土日は全て closed。サマータイムや臨時休場は未対応の概算。",
  inputSchema: {},
  handler: async () => {
    const statuses = getSessionStatuses();
    return jsonReply({
      now: new Date().toISOString(),
      sessions: statuses.map((s) => ({
        id: s.session.id,
        label: s.session.label,
        state: s.state,
        openHourJst: s.session.openHourJst,
        closeHourJst: s.session.closeHourJst,
        hoursUntilOpen: s.hoursUntilOpen,
        hoursUntilClose: s.hoursUntilClose,
      })),
      note: "通常営業時間ベースの概算。祝日・臨時休場は反映されません。",
    });
  },
};
