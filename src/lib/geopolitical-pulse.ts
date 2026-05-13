// 地政学リアルタイム速報（v0.9.0 新設）。
// 主要通信社の RSS フィードを並列取得・dedupe・時刻ソートして返す。
// 客観性の基盤: 「主要通信社が編集判断のうえ配信した記事」のメタデータ。
// 主観的な解釈（marketImplications 等）はツール側では付与せず、LLM の責務とする。
//
// PoC 結果（scripts/rss-poc.mjs）:
//   - BBC World / Al Jazeera / Google News topic-search が認証不要・無料・低レイテンシで動作
//   - Reuters / AP / NHK の RSS は仕様変更で 404（採用見送り）
//   - 並列フェッチでも RSS 側のレート制限は問題にならない

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type PulseTopic = "us-china" | "middle-east" | "ukraine" | "japan" | "global";

export const PULSE_TOPIC_LABEL: Record<PulseTopic, string> = {
  "us-china": "米中（首脳会談・貿易・関税・台湾）",
  "middle-east": "中東（イラン・ホルムズ・イスラエル・ガザ）",
  ukraine: "ウクライナ・ロシア（和平・侵攻・支援・制裁）",
  japan: "日本外交（要人訪問・首脳会談）",
  global: "地政学全般",
};

// トピック別キーワード（BBC / Al Jazeera のフィード内キーワード絞り込み + Google News 検索クエリ）。
// OR を効かせるため小文字化済みの単語配列で保持。
// 注意: "trump" のような単語は単独で米国内ニュースを大量に拾うため、地理/topic 特定語を採用する。
const TOPIC_KEYWORDS: Record<PulseTopic, readonly string[]> = {
  "us-china": ["china", "chinese", "xi jinping", "beijing", "taiwan", "tariff", "trade war"],
  "middle-east": ["iran", "hormuz", "israel", "gaza", "hezbollah", "tehran", "middle east"],
  ukraine: ["ukraine", "ukrainian", "russia", "russian", "kyiv", "moscow", "putin", "zelensky"],
  // 首相名は寿命が短いので「現職 + 直近の前任 2-3 名」を保持。新総理就任時は更新する。
  // 2026-05 時点の現職: 高市早苗（takaichi）
  japan: ["japan", "japanese", "tokyo", "takaichi", "ishiba", "kishida"],
  global: [], // 全件通す（global は dedupe + 時刻ソート + maxItems カット）
};

// Google News のトピック検索クエリ（URL エンコード前）。
const TOPIC_GOOGLE_QUERY: Record<PulseTopic, string> = {
  "us-china": "Trump Xi China summit OR tariff OR trade",
  "middle-east": "Iran OR Israel OR Gaza OR Hormuz",
  ukraine: "Ukraine OR Russia ceasefire OR peace OR invasion",
  japan: "Japan diplomatic OR prime minister OR summit",
  global: "geopolitics OR diplomatic crisis",
};

// 記事の正規化形（出力スキーマ）。
export type PulseArticle = {
  title: string;
  url: string;
  publishedAt: string | null; // ISO 8601。元 RSS の pubDate を変換失敗時は null
  source: string; // feed のラベル
  description?: string;
};

// フィード取得結果。エラー時も sources 配列に含めて部分成功を伝える。
export type FeedResult = {
  key: string;
  label: string;
  ok: boolean;
  count: number;
  error?: string;
  elapsedMs: number;
};

const UA = "Mozilla/5.0 (compatible; lit-forge-mcp/0.9; +https://github.com/noblabs/lit-forge-mcp)";
const FETCH_TIMEOUT_MS = 10_000;

// フィード定義。各フィードは静的 URL or トピック依存 URL を返す。
type FeedDef = {
  key: string;
  label: string;
  buildUrl: (topic: PulseTopic) => string;
  // フィード内のキーワード絞り込みをするか（global なら false）
  keywordFilter: boolean;
};

const FEEDS: readonly FeedDef[] = [
  {
    key: "bbc-world",
    label: "BBC World",
    buildUrl: () => "https://feeds.bbci.co.uk/news/world/rss.xml",
    keywordFilter: true,
  },
  {
    key: "aljazeera",
    label: "Al Jazeera English",
    buildUrl: () => "https://www.aljazeera.com/xml/rss/all.xml",
    keywordFilter: true,
  },
  {
    key: "google-news",
    label: "Google News",
    buildUrl: (topic) => {
      const q = encodeURIComponent(TOPIC_GOOGLE_QUERY[topic]);
      return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
    },
    keywordFilter: false, // Google News は検索クエリで既に絞られている
  },
];

// 1 フィード分の RSS をフェッチ → パース → 記事配列に変換。
export async function fetchFeed(
  feed: FeedDef,
  topic: PulseTopic,
): Promise<{ result: FeedResult; articles: PulseArticle[] }> {
  const t0 = Date.now();
  const url = feed.buildUrl(topic);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) {
      return {
        result: {
          key: feed.key,
          label: feed.label,
          ok: false,
          count: 0,
          error: `HTTP ${res.status}`,
          elapsedMs: Date.now() - t0,
        },
        articles: [],
      };
    }
    const xml = await res.text();
    const articles = parseRss(xml, feed.label);
    const filtered =
      feed.keywordFilter && topic !== "global"
        ? articles.filter((a) => matchesTopicKeywords(a, topic))
        : articles;
    return {
      result: {
        key: feed.key,
        label: feed.label,
        ok: true,
        count: filtered.length,
        elapsedMs: Date.now() - t0,
      },
      articles: filtered,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return {
      result: {
        key: feed.key,
        label: feed.label,
        ok: false,
        count: 0,
        error: msg,
        elapsedMs: Date.now() - t0,
      },
      articles: [],
    };
  }
}

// RSS 2.0 / Atom の <item> または <entry> を抽出する最小パーサー。
// 依存追加を避けるため正規表現ベース（依存追加してもよくなったら fast-xml-parser に切り替え）。
export function parseRss(xml: string, source: string): PulseArticle[] {
  const out: PulseArticle[] = [];
  const itemRe = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const body = m[2];
    const title = extractTag(body, "title");
    const link = extractTag(body, "link") ?? extractLinkHref(body);
    const rawDate =
      extractTag(body, "pubDate") ||
      extractTag(body, "updated") ||
      extractTag(body, "published");
    const description = extractTag(body, "description") || extractTag(body, "summary");
    if (!title || !link) continue;
    out.push({
      title: cleanText(title),
      url: cleanText(link),
      publishedAt: normalizeDate(rawDate),
      source,
      description: description ? cleanText(description).slice(0, 300) : undefined,
    });
  }
  return out;
}

function extractTag(body: string, tag: string): string | null {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const mm = body.match(re);
  return mm ? mm[1] : null;
}

// Atom 形式の <link href="..."/> 対応。
function extractLinkHref(body: string): string | null {
  const mm = body.match(/<link\b[^>]*\bhref="([^"]+)"/);
  return mm ? mm[1] : null;
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
    .replace(/&nbsp;/g, " ")
    .trim();
}

// pubDate 文字列を ISO 8601 に正規化。失敗時は null。
export function normalizeDate(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = cleanText(raw);
  const t = Date.parse(cleaned);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

// タイトルからトピックキーワード一致を判定（小文字部分一致 OR）。
export function matchesTopicKeywords(
  article: PulseArticle,
  topic: PulseTopic,
): boolean {
  const keywords = TOPIC_KEYWORDS[topic];
  if (keywords.length === 0) return true;
  const haystack = (article.title + " " + (article.description ?? "")).toLowerCase();
  return keywords.some((kw) => haystack.includes(kw));
}

// タイトルの正規化キー（小文字 + 記号除去 + 先頭 60 文字）で重複判定。
export function articleDedupeKey(article: PulseArticle): string {
  return article.title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

// 配列を dedupe（先勝ち）。
export function dedupeArticles(articles: readonly PulseArticle[]): PulseArticle[] {
  const seen = new Set<string>();
  const out: PulseArticle[] = [];
  for (const a of articles) {
    const k = articleDedupeKey(a);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

// hoursBack より古い記事を除外。publishedAt が null の記事は通す（不明 = 新しい可能性）。
export function filterByRecency(
  articles: readonly PulseArticle[],
  hoursBack: number,
  now: Date = new Date(),
): PulseArticle[] {
  const cutoff = now.getTime() - hoursBack * 3600 * 1000;
  return articles.filter((a) => {
    if (!a.publishedAt) return true;
    const t = Date.parse(a.publishedAt);
    return Number.isNaN(t) ? true : t >= cutoff;
  });
}

// 新しい順にソート。publishedAt が null の記事は末尾に。
export function sortByDateDesc(
  articles: readonly PulseArticle[],
): PulseArticle[] {
  return [...articles].sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : -Infinity;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : -Infinity;
    return tb - ta;
  });
}

// メイン: 全フィード並列取得 → 統合 → dedupe → recency フィルタ → ソート → maxItems カット。
export async function fetchPulse(opts: {
  topic: PulseTopic;
  maxItems: number;
  hoursBack: number;
}): Promise<{
  topic: PulseTopic;
  topicLabel: string;
  fetchedAt: string;
  sources: FeedResult[];
  articles: PulseArticle[];
  truncated: boolean;
}> {
  const settled = await Promise.all(
    FEEDS.map((f) => fetchFeed(f, opts.topic)),
  );
  const allArticles = settled.flatMap((s) => s.articles);
  const sources = settled.map((s) => s.result);

  const deduped = dedupeArticles(allArticles);
  const recent = filterByRecency(deduped, opts.hoursBack);
  const sorted = sortByDateDesc(recent);
  const truncated = sorted.length > opts.maxItems;
  const articles = sorted.slice(0, opts.maxItems);

  return {
    topic: opts.topic,
    topicLabel: PULSE_TOPIC_LABEL[opts.topic],
    fetchedAt: new Date().toISOString(),
    sources,
    articles,
    truncated,
  };
}

// MCP CallToolResult 用のシリアライズヘルパー（types.ts に依存させたくないので分離）。
export function toCallToolResult(payload: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}
