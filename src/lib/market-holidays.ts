// 主要市場（東京・上海・ロンドン・NY）の取引所休場日データ。
// 経済イベントと同じく手動キュレーション方式（半年〜1 年単位の更新）。
// 第三者 API に依存しない自前データ → AdSense YMYL 配慮 + ソース変更で死なない。
//
// 注意:
//   - 中国（春節・国慶節等）の長期休場は当局発表で前年末に確定するため、毎年初に更新が必要
//   - 米英の早期クローズ（Christmas Eve 等の半日場）はここでは扱わず、終日休場のみ
//   - 振替休日・連休は個別に列挙（自動計算しない、誤りリスク回避）

import type { MarketId } from "./sessions.js";

export type MarketHoliday = {
  market: MarketId;
  date: string; // YYYY-MM-DD（JST 基準、市場現地暦と一致する日に統一）
  name: string; // 休場名（日本語）
};

export const MARKET_HOLIDAYS_LAST_UPDATED = "2026-05-06";

export const MARKET_HOLIDAYS: readonly MarketHoliday[] = [
  // ============ 東京 (TSE) 2026 ============
  // 国民の祝日 + TSE 取引所規程による休場（年末年始 1/2-1/3、12/31）
  { market: "tokyo", date: "2026-01-01", name: "元日" },
  { market: "tokyo", date: "2026-01-02", name: "TSE 年始休場" },
  { market: "tokyo", date: "2026-01-12", name: "成人の日" },
  { market: "tokyo", date: "2026-02-11", name: "建国記念の日" },
  { market: "tokyo", date: "2026-02-23", name: "天皇誕生日" },
  { market: "tokyo", date: "2026-03-20", name: "春分の日" },
  { market: "tokyo", date: "2026-04-29", name: "昭和の日" },
  { market: "tokyo", date: "2026-05-04", name: "みどりの日" },
  { market: "tokyo", date: "2026-05-05", name: "こどもの日" },
  { market: "tokyo", date: "2026-05-06", name: "振替休日（憲法記念日）" },
  { market: "tokyo", date: "2026-07-20", name: "海の日" },
  { market: "tokyo", date: "2026-08-11", name: "山の日" },
  { market: "tokyo", date: "2026-09-21", name: "敬老の日" },
  { market: "tokyo", date: "2026-09-22", name: "国民の休日" },
  { market: "tokyo", date: "2026-09-23", name: "秋分の日" },
  { market: "tokyo", date: "2026-10-12", name: "スポーツの日" },
  { market: "tokyo", date: "2026-11-03", name: "文化の日" },
  { market: "tokyo", date: "2026-11-23", name: "勤労感謝の日" },
  { market: "tokyo", date: "2026-12-31", name: "TSE 大納会翌日休場" },

  // ============ 上海 (SSE) 2026 ============
  // 春節・国慶節等の長期休場。中国証券監督管理委員会の発表に基づく
  { market: "shanghai", date: "2026-01-01", name: "元旦（新年）" },
  // 春節（2026/2/17 = 旧正月、SSE は 2/16-2/24 休場予定）
  { market: "shanghai", date: "2026-02-16", name: "春節休場" },
  { market: "shanghai", date: "2026-02-17", name: "春節休場" },
  { market: "shanghai", date: "2026-02-18", name: "春節休場" },
  { market: "shanghai", date: "2026-02-19", name: "春節休場" },
  { market: "shanghai", date: "2026-02-20", name: "春節休場" },
  { market: "shanghai", date: "2026-02-23", name: "春節休場" },
  { market: "shanghai", date: "2026-02-24", name: "春節休場" },
  // 清明節
  { market: "shanghai", date: "2026-04-06", name: "清明節" },
  // 労働節（メーデー）
  { market: "shanghai", date: "2026-05-01", name: "労働節" },
  { market: "shanghai", date: "2026-05-04", name: "労働節" },
  { market: "shanghai", date: "2026-05-05", name: "労働節" },
  // 端午節
  { market: "shanghai", date: "2026-06-19", name: "端午節" },
  // 中秋節
  { market: "shanghai", date: "2026-09-25", name: "中秋節" },
  // 国慶節（10/1-10/8 連休）
  { market: "shanghai", date: "2026-10-01", name: "国慶節" },
  { market: "shanghai", date: "2026-10-02", name: "国慶節" },
  { market: "shanghai", date: "2026-10-05", name: "国慶節" },
  { market: "shanghai", date: "2026-10-06", name: "国慶節" },
  { market: "shanghai", date: "2026-10-07", name: "国慶節" },
  { market: "shanghai", date: "2026-10-08", name: "国慶節" },

  // ============ ロンドン (LSE) 2026 ============
  // UK Bank Holidays（England & Wales）。Boxing Day 等の振替も含む
  { market: "london", date: "2026-01-01", name: "New Year's Day" },
  { market: "london", date: "2026-04-03", name: "Good Friday" },
  { market: "london", date: "2026-04-06", name: "Easter Monday" },
  { market: "london", date: "2026-05-04", name: "Early May Bank Holiday" },
  { market: "london", date: "2026-05-25", name: "Spring Bank Holiday" },
  { market: "london", date: "2026-08-31", name: "Summer Bank Holiday" },
  { market: "london", date: "2026-12-25", name: "Christmas Day" },
  { market: "london", date: "2026-12-28", name: "Boxing Day（振替）" },

  // ============ NY (NYSE) 2026 ============
  // US Federal Holidays（observed）。Independence Day は 7/4 が土曜のため 7/3 (Fri) に振替
  { market: "ny", date: "2026-01-01", name: "New Year's Day" },
  { market: "ny", date: "2026-01-19", name: "Martin Luther King Jr. Day" },
  { market: "ny", date: "2026-02-16", name: "Presidents' Day" },
  { market: "ny", date: "2026-04-03", name: "Good Friday" },
  { market: "ny", date: "2026-05-25", name: "Memorial Day" },
  { market: "ny", date: "2026-06-19", name: "Juneteenth" },
  { market: "ny", date: "2026-07-03", name: "Independence Day（振替）" },
  { market: "ny", date: "2026-09-07", name: "Labor Day" },
  { market: "ny", date: "2026-11-26", name: "Thanksgiving Day" },
  { market: "ny", date: "2026-12-25", name: "Christmas Day" },
];

// 高速ルックアップ用の Map: "tokyo|2026-05-06" → MarketHoliday
const HOLIDAY_INDEX = new Map<string, MarketHoliday>(
  MARKET_HOLIDAYS.map((h) => [`${h.market}|${h.date}`, h]),
);

/** 指定市場の指定日付（JST）が休場かどうか */
export function getMarketHoliday(market: MarketId, dateKey: string): MarketHoliday | undefined {
  return HOLIDAY_INDEX.get(`${market}|${dateKey}`);
}

/** Date を JST の YYYY-MM-DD 文字列に変換（economic-events.ts と同じロジック） */
export function jstDateKey(date: Date = new Date()): string {
  const jst = new Date(date.getTime() + 9 * 3600 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
