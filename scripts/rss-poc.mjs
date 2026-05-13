#!/usr/bin/env node
// RSS PoC: GDELT 不調時の代替候補として、主要通信社の World RSS をリアルタイム情報源として検証。
//
// 検証ポイント:
//   1. 認証不要・無料・レート制限のない RSS 取得が可能か
//   2. 内容が十分にリアルタイム（数分〜数時間以内）か
//   3. パース難易度（最小依存で扱えるか）
//   4. lit-forge-mcp の "今日の市況" 用途に必要な情報量があるか

const FEEDS = [
  {
    key: "reuters-world",
    label: "Reuters World",
    url: "https://feeds.reuters.com/Reuters/worldNews",
  },
  {
    key: "bbc-world",
    label: "BBC World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
  },
  {
    key: "ap-top",
    label: "AP Top News",
    url: "https://feeds.apnews.com/apf-topnews",
  },
  {
    key: "nhk-world",
    label: "NHK World",
    url: "https://www3.nhk.or.jp/nhkworld/en/news/feeds/",
  },
  {
    key: "google-news-geo",
    label: 'Google News (search: "geopolitics")',
    url: "https://news.google.com/rss/search?q=geopolitics&hl=en-US&gl=US&ceid=US:en",
  },
  {
    key: "aljazeera",
    label: "Al Jazeera English",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
  },
];

// 最小 XML パーサー: RSS 2.0 / Atom の <item> または <entry> を抽出。
// 正規表現ベース（依存追加なし）。本番では fast-xml-parser など導入を検討。
function parseRss(xml) {
  const items = [];
  const itemRe = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const body = m[2];
    const title = extractTag(body, "title");
    const link = extractTag(body, "link");
    const pubDate = extractTag(body, "pubDate") || extractTag(body, "updated") || extractTag(body, "published");
    const description = extractTag(body, "description") || extractTag(body, "summary");
    items.push({ title, link, pubDate, description: description?.slice(0, 200) });
  }
  return items;
}

function extractTag(body, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const m = body.match(re);
  if (!m) return null;
  let v = m[1].trim();
  // CDATA を剥がす
  v = v.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
  return v.trim();
}

async function probeFeed(feed) {
  console.log(`\n--- ${feed.key}: ${feed.label} ---`);
  console.log(`  url: ${feed.url}`);
  const t0 = Date.now();
  try {
    const res = await fetch(feed.url, {
      headers: {
        "User-Agent": "lit-forge-mcp-poc/0.0.1",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    const elapsed = Date.now() - t0;
    if (!res.ok) {
      console.log(`  ❌ HTTP ${res.status} (${elapsed}ms)`);
      return;
    }
    const xml = await res.text();
    const items = parseRss(xml);
    console.log(`  ✅ ${items.length} items (${elapsed}ms, ${(xml.length / 1024).toFixed(1)} KB)`);
    for (const it of items.slice(0, 5)) {
      console.log(`  • [${it.pubDate ?? "?"}]`);
      console.log(`    ${it.title}`);
    }
  } catch (e) {
    console.log(`  ❌ ${e.message}`);
  }
}

async function main() {
  console.log("=".repeat(70));
  console.log("RSS PoC — GDELT 代替候補の検証");
  console.log("=".repeat(70));

  // 並列フェッチ（RSS は通常レート制限が緩い）
  await Promise.all(FEEDS.map(probeFeed));

  console.log("\n" + "=".repeat(70));
  console.log("評価軸");
  console.log("=".repeat(70));
  console.log(`
- 認証: 全 RSS は認証不要
- レート制限: 並列取得でも問題が出にくい
- リアルタイム性: 通常 5-30 分以内に最新ニュースが反映
- 依存: 正規表現で十分パースできる（or fast-xml-parser ~30KB）
- カバレッジ: 通信社系で世界の地政学を網羅。地域偏りは複数ソース併用で軽減
`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
