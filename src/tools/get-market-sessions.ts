// 主要市場（東京・上海・ロンドン・NY）の現在の取引時間ステータスを返す。
// AI が「今は NY が動いている時間」「東京はもうすぐオープン」「今日は祝日休場」のような時間軸の context を取れる。

import { MARKET_HOLIDAYS_LAST_UPDATED } from "../lib/market-holidays.js";
import { getSessionStatuses } from "../lib/sessions.js";
import { jsonReply, type LitForgeTool } from "./types.js";

export const getMarketSessionsTool: LitForgeTool = {
  name: "get_market_sessions",
  title: "主要市場の取引時間ステータス",
  description:
    "東京（9:00-15:30 JST）/ 上海（10:30-16:00 JST）/ ロンドン（17:00-25:30 JST）/ NY（22:30-29:00 JST）の現在の取引時間ステータス（open / pre-open / closed / holiday）を返します。土日は全て closed、祝日は holiday（holidayName 付）。各市場の祝日カレンダーは手動キュレーション（米英祝日・日本国民の祝日 + TSE 規程・中国の春節等の長期休場）。サマータイム移行や臨時休場は未対応の概算。",
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
        holidayName: s.holidayName,
      })),
      holidaysLastUpdated: MARKET_HOLIDAYS_LAST_UPDATED,
      note: "通常営業時間ベースの概算 + 手動キュレーションの祝日休場。サマータイム移行や臨時休場は未対応。",
    });
  },
};
