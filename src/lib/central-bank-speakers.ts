// 中銀高官の発言・講演スケジュール（v0.18.0 新設、ライブ取得）。
// ForexFactory の無料 週次カレンダー XML を取得し、発言系イベント（"… Speaks/Speech/Testimony"）だけを
// 抽出して返す。「これから」のフォワード予定が取れるのが要点（公式中銀 RSS は delivered 済みの過去ログのみ）。
//
// 役割分担（geopolitical_pulse と同思想）:
//   - 本 lib: フィードを取得し、客観メタ（発言者・国・日付・時刻・重要度）に正規化する
//   - 米 Fed は fomc-roster.ts で「役職・投票権」を補完（FF は名字 + "FOMC Member" しか持たない）
//   - 市場解釈は呼び出し側 LLM の責務
//
// ソース実現性スパイク結果:
//   - FRB / BOJ 公式 RSS は 200 で取れるが delivered 済み（フォワード予定なし）→ 不採用
//   - nfs.faireconomy.media の FF カレンダー XML は無料・無認証・フォワードで発言系を網羅 → 採用
//   - 第三者フィード依存。利用者 PC から faireconomy.media へ毎回アクセスする（pulse 系 RSS と同じ構図）

import type { Country } from "./market-types.js";
import { jstDateKey } from "./economic-events.js";
import { lookupFomcMember } from "./fomc-roster.js";
import { withCache } from "./economic-release-pulse/cache.js";

const UA =
  "Mozilla/5.0 (compatible; lit-forge-mcp/0.18; +https://github.com/noblabs/lit-forge-mcp)";
const FETCH_TIMEOUT_MS = 10_000;
// 発言予定は日内でほぼ変わらないため 6h キャッシュ。
const CACHE_TTL_MS = 6 * 3600 * 1000;

// FF 週次フィード。faireconomy ミラーは thisweek（現 FF 週=月〜日）のみ提供（nextweek/thismonth は 404）。
// そのため range=week が現 FF 週の末尾を越える日（来週分）は、その週が thisweek になるまで取得できない。
const FF_FEEDS: readonly { key: string; url: string }[] = [
  { key: "ff-thisweek", url: "https://nfs.faireconomy.media/ff_calendar_thisweek.xml" },
];

export type SpeakerRange = "today" | "week";

// FF の生イベント（パース直後）。
export type FfEvent = {
  title: string;
  country: string; // FF の通貨コード（USD/JPY/EUR/GBP/...）
  date: string; // FF は MM-DD-YYYY
  time: string; // "2:00pm" / "All Day" / "Tentative" / ""
  impact: string; // Low / Medium / High / Holiday / ""
  url?: string;
};

// 正規化後の発言イベント（出力スキーマ）。
export type CentralBankSpeaker = {
  date: string; // YYYY-MM-DD
  time: string; // FF の時刻表記そのまま
  country: Country;
  org: string; // 中銀ラベル（FRB / 日銀 / ECB / BOE 等）
  speaker: string; // 名字（FF タイトル末尾）
  role?: string; // 役職（FOMC ロースターヒット時のみ）
  votingMember?: boolean; // 投票権（米 Fed のみ）
  votingStatus?: string; // "投票権あり" / "投票権なし"（votingMember 確定時）
  importance: 1 | 2 | 3;
  ffImpact: string; // FF の impact 原値（参考）
  rawTitle: string; // FF 原題（"FOMC Member Logan Speaks"）
  url?: string;
};

export type FeedResult = {
  key: string;
  ok: boolean;
  count: number;
  error?: string;
  elapsedMs: number;
};

// ── FF 通貨コード → 国 + 中銀ラベル ──
const CURRENCY_MAP: Readonly<Record<string, { country: Country; org: string }>> = {
  USD: { country: "US", org: "FRB" },
  JPY: { country: "JP", org: "日銀" },
  EUR: { country: "EU", org: "ECB" },
  GBP: { country: "GB", org: "BOE" },
  CNY: { country: "CN", org: "中国人民銀行" },
  CAD: { country: "OTHER", org: "カナダ銀行" },
  AUD: { country: "OTHER", org: "豪準備銀行(RBA)" },
  NZD: { country: "OTHER", org: "NZ準備銀行(RBNZ)" },
  CHF: { country: "OTHER", org: "スイス国立銀行(SNB)" },
};

// 発言系イベントかどうか（指標・休場・会合結果などは除外）。
export function isSpeechEvent(title: string): boolean {
  return /\b(speaks|speech|testifies|testimony|remarks)\b/i.test(title);
}

// FF タイトルから発言者の名字を取り出す。
// 例: "FOMC Member Logan Speaks" → "Logan" / "BOJ Gov Ueda Speaks" → "Ueda" /
//     "ECB President Lagarde Speaks" → "Lagarde"。発言動詞を落とした末尾の語を名字とみなす。
export function extractSurname(title: string): string {
  const stripped = title
    .replace(/\b(speaks|speech|testifies|testimony|remarks)\b.*$/i, "")
    .trim();
  const words = stripped.split(/\s+/).filter(Boolean);
  return words.length > 0 ? words[words.length - 1] : stripped;
}

// FF impact → 基礎 importance。
export function ffImpactToImportance(impact: string): 1 | 2 | 3 {
  switch (impact.trim().toLowerCase()) {
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1; // low / holiday / 空
  }
}

// FF date（MM-DD-YYYY）→ YYYY-MM-DD。変換できなければ null。
export function ffDateToIso(d: string): string | null {
  const m = d.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1]}-${m[2]}`;
}

// 生 XML から <event> を抽出（正規表現ベース。geopolitical-pulse と同方針で依存を増やさない）。
export function parseFfEvents(xml: string): FfEvent[] {
  const out: FfEvent[] = [];
  const re = /<event\b[^>]*>([\s\S]*?)<\/event>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const body = m[1];
    const title = field(body, "title");
    const country = field(body, "country");
    const date = field(body, "date");
    if (!title || !date) continue;
    out.push({
      title,
      country,
      date,
      time: field(body, "time"),
      impact: field(body, "impact"),
      url: field(body, "url") || undefined,
    });
  }
  return out;
}

function field(body: string, tag: string): string {
  const m = body.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? cleanText(m[1]) : "";
}

function cleanText(s: string): string {
  return s
    .replace(/^\s*<!\[CDATA\[/, "")
    .replace(/\]\]>\s*$/, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// 生イベント 1 件 → 発言イベントに正規化（enrich 込み）。発言系でなければ null。
export function toSpeaker(ev: FfEvent): CentralBankSpeaker | null {
  if (!isSpeechEvent(ev.title)) return null;
  const iso = ffDateToIso(ev.date);
  if (!iso) return null;

  const cur = CURRENCY_MAP[ev.country.toUpperCase()] ?? {
    country: "OTHER" as Country,
    org: ev.country,
  };
  const surname = extractSurname(ev.title);
  const base = ffImpactToImportance(ev.impact);

  const speaker: CentralBankSpeaker = {
    date: iso,
    time: ev.time || "未定",
    country: cur.country,
    org: cur.org,
    speaker: surname,
    importance: base,
    ffImpact: ev.impact || "Low",
    rawTitle: ev.title,
    url: ev.url,
  };

  // 米 Fed は FOMC ロースターで役職・投票権を補完し、重要度を引き上げる。
  if (cur.country === "US") {
    const m = lookupFomcMember(surname);
    if (m) {
      speaker.role = m.roleJa;
      speaker.votingMember = m.votingMember;
      speaker.votingStatus = m.votingMember ? "投票権あり" : "投票権なし";
      // 議長は最重要、投票メンバーは最低 ★★（市場インパクトが大きい）。
      if (m.isChair) speaker.importance = 3;
      else if (m.votingMember) speaker.importance = (Math.max(base, 2) as 1 | 2 | 3);
    }
  }
  return speaker;
}

// JST today から range 分の日付集合（today=当日 / week=当日〜+6 日）を作る。
function rangeDateSet(range: SpeakerRange, today: string): Set<string> {
  if (range === "today") return new Set([today]);
  const start = new Date(`${today}T00:00:00+09:00`);
  const set = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    set.add(jstDateKey(d));
  }
  return set;
}

// 生イベント配列 → 発言イベントを抽出・enrich・期間/国フィルタ・ソート（純関数。テスト用）。
export function selectSpeakers(
  events: readonly FfEvent[],
  opts: { range: SpeakerRange; today: string; countries?: readonly Country[] },
): CentralBankSpeaker[] {
  const dateSet = rangeDateSet(opts.range, opts.today);
  const countrySet =
    opts.countries && opts.countries.length > 0 ? new Set(opts.countries) : null;

  const speakers: CentralBankSpeaker[] = [];
  const seen = new Set<string>();
  for (const ev of events) {
    const s = toSpeaker(ev);
    if (!s) continue;
    if (!dateSet.has(s.date)) continue;
    if (countrySet && !countrySet.has(s.country)) continue;
    // 同一発言の重複を除去（フィード内の重複・将来複数フィード化への保険）。
    const key = `${s.date}|${s.country}|${s.rawTitle}`;
    if (seen.has(key)) continue;
    seen.add(key);
    speakers.push(s);
  }
  // 日付昇順 → 重要度降順 → 国コード。
  speakers.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      b.importance - a.importance ||
      a.country.localeCompare(b.country),
  );
  return speakers;
}

// 1 フィードを取得してパース。失敗時は ok:false で部分成功を伝える。
async function fetchFeed(
  feed: { key: string; url: string },
): Promise<{ result: FeedResult; events: FfEvent[] }> {
  const t0 = Date.now();
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": UA, Accept: "application/xml, text/xml, */*" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) {
      return {
        result: { key: feed.key, ok: false, count: 0, error: `HTTP ${res.status}`, elapsedMs: Date.now() - t0 },
        events: [],
      };
    }
    const xml = await res.text();
    const events = parseFfEvents(xml);
    return {
      result: { key: feed.key, ok: true, count: events.length, elapsedMs: Date.now() - t0 },
      events,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return {
      result: { key: feed.key, ok: false, count: 0, error: msg, elapsedMs: Date.now() - t0 },
      events: [],
    };
  }
}

// 全フィード失敗を withCache に焼かせないための番兵エラー（部分結果を運ぶ）。
class AllFeedsFailedError extends Error {
  constructor(public readonly partial: { events: FfEvent[]; sources: FeedResult[] }) {
    super("all central-bank-speaker feeds failed");
  }
}

// メイン: フィードを並列取得（6h キャッシュ）→ 発言抽出・enrich・フィルタ・ソート。
// fetchOk=false（全フィード失敗）のときは「予定なし」ではなく「取得失敗」を示す。失敗結果はキャッシュしない。
export async function fetchCentralBankSpeakers(opts: {
  range: SpeakerRange;
  countries?: readonly Country[];
}): Promise<{
  range: SpeakerRange;
  today: string;
  fetchedAt: string;
  fetchOk: boolean;
  sources: FeedResult[];
  speakers: CentralBankSpeaker[];
}> {
  const today = jstDateKey();
  let fetched: { events: FfEvent[]; sources: FeedResult[] };
  try {
    fetched = await withCache("central-bank-speakers:feeds", CACHE_TTL_MS, async () => {
      const settled = await Promise.all(FF_FEEDS.map((f) => fetchFeed(f)));
      const result = {
        events: settled.flatMap((s) => s.events),
        sources: settled.map((s) => s.result),
      };
      // 全フィード失敗（例: 429）はキャッシュさせない（throw すると withCache は格納しない）。
      // 次回呼び出しでリトライできるようにし、一過性の失敗が 6h 居座るのを防ぐ。
      if (!result.sources.some((s) => s.ok)) throw new AllFeedsFailedError(result);
      return result;
    });
  } catch (e) {
    if (e instanceof AllFeedsFailedError) fetched = e.partial;
    else throw e;
  }

  const fetchOk = fetched.sources.some((s) => s.ok);
  const speakers = fetchOk
    ? selectSpeakers(fetched.events, { range: opts.range, today, countries: opts.countries })
    : [];
  return {
    range: opts.range,
    today,
    fetchedAt: new Date().toISOString(),
    fetchOk,
    sources: fetched.sources,
    speakers,
  };
}
