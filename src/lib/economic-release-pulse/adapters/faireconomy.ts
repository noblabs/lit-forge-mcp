// ForexFactory（faireconomy ミラー）週次カレンダー XML から、他アダプタが
// カバーしていない米指標をライブ取得するアダプタ（v0.20.0 新設）。
//
// 背景・経緯:
//   - もともと JOLTS 専用アダプタ（静的手転記）として実装したが、ユーザー指摘
//     「動的取得しなければ将来分の手動追記問題が消えない」を受けてライブ化。
//   - さらに S&P Global PMI 速報（旧 sp-global-pmi.ts の手転記静的データ。2026-05 しか
//     確認できず以降が空＝実質 stale だった）も本アダプタのライブ取得に統合し、静的版を撤去。
//   - ISM 製造業/非製造業・消費者信頼感（CB / ミシガン大）・ADP 雇用は、これまで
//     get_economic_events_today の手動キュレーションにしか無かった（or どこにも無かった）。
//     FF フィードに載るため pulse にライブ追加し、半年手動追記を不要にした。
//
// 取得方式: get_central_bank_speakers と同じ FF 週次 XML
//   (https://nfs.faireconomy.media/ff_calendar_thisweek.xml) を 1 回 fetch（6h キャッシュ）し、
//   下記マップに載る米（USD）イベントだけを ReleaseEvent に変換する。
//   - PFEI（雇用統計・CPI・PPI）/ DOL/ETA（失業保険）/ BEA / センサス局 等が
//     既にカバーする指標は **マップに入れない**（pulse 内での重複を避けるため）。
//     特に DOL は曜日計算で複数週先まで出せるが FF は今週のみのため、置換せず据え置き。
//   - 出所が官製一次ソースで取れるもの（BLS 三大指標）は PFEI 側を正とし、本アダプタは扱わない。
//
// 時刻の扱い: FF フィードの時刻は GMT(UTC+0) 基準（JOLTS の "2:00pm" = 14:00 UTC =
//   10:00 EDT で既知の発表時刻と一致。Europe/London の BST ではなく真の UTC+0 年中）。
//   pulse は JST 日付でフィルタ・表示するため、フィードの GMT 日時を UTC インスタントと
//   して解釈し JST に変換する（冬の 10:00 EST = 15:00 UTC = 00:00 JST 翌日 の日跨ぎも正しい）。
//
// 制約: faireconomy は thisweek（現 FF 週）のみ提供。range=week が現 FF 週末を越える
//   来週分は、その週が thisweek になるまで出ない（中銀発言アダプタと同じ既知の限界）。

import type { ReleaseAdapter, ReleaseEvent } from "../types.js";
import { jstParts } from "../util.js";
import { withCache } from "../cache.js";
import { parseFfEvents, type FfEvent } from "../../central-bank-speakers.js";

const CACHE_TTL_MS = 6 * 3600 * 1000; // 発表予定は日内でほぼ変わらない
const FETCH_TIMEOUT_MS = 10_000;
const FF_FEED_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.xml";
const FF_CALENDAR_URL = "https://www.forexfactory.com/calendar";
const UA =
  "Mozilla/5.0 (compatible; lit-forge-mcp/0.20; +https://github.com/noblabs/lit-forge-mcp)";

// 取り込む米（USD）指標: FF タイトル（小文字・trim 済）→ 日本語表示名。
// 完全一致でのみ拾う（"ISM Manufacturing Prices" 等の部分一致誤爆を避ける）。
// ⚠️ PFEI / DOL/ETA / BEA / センサス局 が既に出す指標は入れない（pulse 内重複防止）。
const FF_US_TITLE_MAP: Readonly<Record<string, string>> = {
  "jolts job openings": "米 JOLTS（求人件数）",
  "flash manufacturing pmi": "米 製造業PMI（速報）",
  "flash services pmi": "米 サービス業PMI（速報）",
  "ism manufacturing pmi": "米 ISM製造業景況指数",
  "ism services pmi": "米 ISM非製造業景況指数",
  "cb consumer confidence": "米 消費者信頼感指数（CB）",
  "prelim uom consumer sentiment": "米 ミシガン大消費者信頼感（速報）",
  "revised uom consumer sentiment": "米 ミシガン大消費者信頼感（確報）",
  "adp non-farm employment change": "米 ADP雇用統計（民間部門）",
};

// FF タイトル → 取り込み対象の日本語名（対象外なら null）。
export function ffTitleToName(title: string): string | null {
  return FF_US_TITLE_MAP[title.trim().toLowerCase()] ?? null;
}

// "2:00pm" / "10:30am" → { h, m }（24 時間表記）。解釈不能（All Day/Tentative/空）は null。
export function parseFfClock(time: string): { h: number; m: number } | null {
  const m = time.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!m) return null;
  let h = Number(m[1]) % 12; // 12am→0 / 12pm→0(+12 で 12)
  const min = Number(m[2]);
  if (m[3].toLowerCase() === "pm") h += 12;
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

// FF イベント 1 件 → ReleaseEvent。対象外（USD でない / マップ外 / 時刻不明）は null。
// FF の date(MM-DD-YYYY) + time(GMT) を UTC インスタントとして JST に変換する。
export function ffEventToRelease(ev: FfEvent): ReleaseEvent | null {
  if (ev.country.toUpperCase() !== "USD") return null;
  const name = ffTitleToName(ev.title);
  if (!name) return null;
  const dm = ev.date.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/); // MM-DD-YYYY
  if (!dm) return null;
  const clock = parseFfClock(ev.time);
  if (!clock) return null; // 時刻不明は出さない（JST 日付を誤らせないため）
  const [, mm, dd, yyyy] = dm;
  const epochMs = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), clock.h, clock.m);
  const { date, time } = jstParts(epochMs);
  return {
    date,
    time,
    country: "US",
    name,
    source: "ForexFactory",
    sourceUrl: ev.url || FF_CALENDAR_URL,
  };
}

// 生 FF イベント配列 → 対象指標の ReleaseEvent[]（純関数・テスト用 export）。
export function selectFaireconomyEvents(events: readonly FfEvent[]): ReleaseEvent[] {
  const out: ReleaseEvent[] = [];
  for (const ev of events) {
    const r = ffEventToRelease(ev);
    if (r) out.push(r);
  }
  return out;
}

// FF 週次フィードを取得して対象指標を抽出（6h キャッシュ）。
async function fetchFaireconomyReleases(): Promise<ReleaseEvent[]> {
  return withCache("faireconomy:ff-thisweek", CACHE_TTL_MS, async () => {
    const res = await fetch(FF_FEED_URL, {
      headers: { "User-Agent": UA, Accept: "application/xml, text/xml, */*" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return selectFaireconomyEvents(parseFfEvents(xml));
  });
}

export const faireconomyAdapter: ReleaseAdapter = {
  key: "faireconomy",
  label:
    "ForexFactory（米 JOLTS / PMI速報 / ISM / 消費者信頼感 / ADP・ライブ）",
  fetchEvents: fetchFaireconomyReleases,
};
