// 主要市場の取引時間帯を JST 基準で判定する純関数。
// 東京・ロンドン・ニューヨーク・上海の取引時間を JST 換算してオープン/クローズ判定する。
// 祝日や臨時休場までは追わない（運営許容範囲）。

export type MarketSession = {
  id: "tokyo" | "london" | "ny" | "shanghai";
  label: string;
  // 取引時間（JST、24h 表記、30 分刻みは整数 + 0.5 で表現）
  openHourJst: number;
  closeHourJst: number;
};

// 通常取引時間（JST、サマータイム未考慮）。
// 東京: 9:00-15:30 JST
// 上海: 10:30-16:00 JST
// ロンドン: 17:00-25:30 JST（17:00-翌1:30）— UTC 8:00-16:30
// NY: 22:30-29:00 JST（22:30-翌5:00）— UTC 13:30-20:00
export const MARKET_SESSIONS: readonly MarketSession[] = [
  { id: "tokyo", label: "東京", openHourJst: 9, closeHourJst: 15.5 },
  { id: "shanghai", label: "上海", openHourJst: 10.5, closeHourJst: 16 },
  { id: "london", label: "ロンドン", openHourJst: 17, closeHourJst: 25.5 },
  { id: "ny", label: "NY", openHourJst: 22.5, closeHourJst: 29 },
];

export type SessionStatus = {
  session: MarketSession;
  state: "open" | "closed" | "pre-open";
  // pre-open のとき：オープンまでの残り時間（時間単位、小数）
  hoursUntilOpen?: number;
  // open のとき：クローズまでの残り時間
  hoursUntilClose?: number;
};

// JST 時刻（now）から各市場のステータスを判定。
// open: 取引中、pre-open: 30 分以内にオープン、closed: それ以外。
export function getSessionStatuses(now: Date = new Date()): SessionStatus[] {
  const jstMs = now.getTime() + 9 * 3600 * 1000;
  const jst = new Date(jstMs);
  const dayOfWeek = jst.getUTCDay(); // 0=日, 6=土（JST 換算で）
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  // 現在時刻を「24h 換算の小数」で表現（例: 22:30 → 22.5）。
  // 翌日にまたがるセッションは現在時刻 + 24 とも比較できるよう dual で持つ。
  const hour = jst.getUTCHours() + jst.getUTCMinutes() / 60;
  return MARKET_SESSIONS.map((s): SessionStatus => {
    if (isWeekend) {
      // 週末は基本クローズ（厳密には金曜深夜の NY セッション越境はあるが省略）
      return { session: s, state: "closed" };
    }
    // 取引時間判定（hour と hour+24 の両方をチェック）
    let state: SessionStatus["state"] = "closed";
    let hoursUntilOpen: number | undefined;
    let hoursUntilClose: number | undefined;
    const candidates = [hour, hour + 24];
    for (const h of candidates) {
      if (h >= s.openHourJst && h < s.closeHourJst) {
        state = "open";
        hoursUntilClose = s.closeHourJst - h;
        return { session: s, state, hoursUntilClose };
      }
      const delta = s.openHourJst - h;
      if (delta > 0 && delta <= 0.5) {
        state = "pre-open";
        hoursUntilOpen = delta;
      }
    }
    return { session: s, state, hoursUntilOpen, hoursUntilClose };
  });
}
