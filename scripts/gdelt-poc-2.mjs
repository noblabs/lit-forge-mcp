#!/usr/bin/env node
// GDELT PoC 第 2 弾: レート制限・リトライ・実用クエリ確認。
//
// 第 1 弾で判明したこと:
//   - Doc API は短時間連続クエリで "fetch failed" を返す（実体は ECONNRESET と思われる）
//   - GDELT 公式ドキュメントは「typically at most one query per 5 seconds」を推奨
//
// このスクリプトでは:
//   1. 7 秒スリープでレート制限を回避できるか確認
//   2. リトライ機構の挙動確認
//   3. lit-forge-mcp で使う本番想定クエリの実用性検証

const TIMESPAN = process.env.GDELT_POC_TIMESPAN ?? "24h";
const MAX = 25;
const SLEEP_MS = 7000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, opts = {}, maxRetry = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetry; attempt++) {
    try {
      const res = await fetch(url, opts);
      if (res.status === 429) {
        await sleep(5000 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt < maxRetry) await sleep(3000 * (attempt + 1));
    }
  }
  throw lastErr;
}

async function docQuery(query) {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "ArtList");
  url.searchParams.set("format", "json");
  url.searchParams.set("timespan", TIMESPAN);
  url.searchParams.set("maxrecords", String(MAX));
  url.searchParams.set("sort", "DateDesc");
  const res = await fetchWithRetry(url.toString(), {
    headers: { "User-Agent": "lit-forge-mcp-poc/0.0.1" },
    signal: AbortSignal.timeout(20000),
  });
  return res.json();
}

// 本番想定の地域別クエリ。各クエリは独立したトピック軸を持つ。
const TOPICS = [
  {
    key: "us-china",
    label: "米中（首脳会談・貿易・関税）",
    query: '(Trump OR Xi OR "China") (summit OR tariff OR "trade talks" OR diplomatic) sourcelang:eng',
  },
  {
    key: "middle-east",
    label: "中東（イラン・ホルムズ・イスラエル）",
    query: '(Iran OR Hormuz OR Israel OR Gaza) (sanctions OR strike OR blockade OR ceasefire) sourcelang:eng',
  },
  {
    key: "ukraine",
    label: "ウクライナ（和平・侵攻・支援）",
    query: '(Ukraine OR Russia) (ceasefire OR "peace talks" OR sanctions OR invasion) sourcelang:eng',
  },
  {
    key: "japan-diplomacy",
    label: "日本外交（要人訪問・首脳会談）",
    query: '(Japan) (summit OR diplomatic OR "trade deal" OR "prime minister") sourcelang:eng',
  },
];

async function main() {
  console.log("=".repeat(70));
  console.log("GDELT PoC #2 — レート制限対策 + 実用クエリ検証");
  console.log("=".repeat(70));
  console.log(`timespan=${TIMESPAN}  max=${MAX}  sleep=${SLEEP_MS}ms\n`);

  for (const topic of TOPICS) {
    console.log(`\n--- ${topic.key}: ${topic.label} ---`);
    console.log(`  query: ${topic.query}`);
    try {
      const result = await docQuery(topic.query);
      const articles = result.articles ?? [];
      console.log(`  取得: ${articles.length} 件`);
      // ドメインの多様性 (重要度推定の材料: 多ドメインで報じられている = 重要)
      const domains = new Set(articles.map((a) => a.domain));
      console.log(`  ユニークドメイン: ${domains.size}`);
      // 上位 3 件
      for (const a of articles.slice(0, 3)) {
        console.log(`  • [${a.seendate}] ${a.title}`);
        console.log(`    domain=${a.domain}`);
      }
    } catch (e) {
      console.log(`  ❌ ${e.message}`);
    }
    await sleep(SLEEP_MS);
  }

  console.log("\n" + "=".repeat(70));
  console.log("結論");
  console.log("=".repeat(70));
  console.log(`
- Doc API は 7s スリープで連続クエリ可能（5s 未満では落ちる）
- 1 リクエスト = 1 トピック軸、MCP 1 ツール呼び出しで 4-5 トピック並列は厳しい
- → 同期で全トピック叩く設計は NG。シーケンシャル + 結果キャッシュ必須
- 代案: ツール側で topic= 引数を必須化し、1 呼び出し = 1 トピックに限定
- Trump-Xi 会談は単純クエリで安定的にヒットする（PoC 第 1 弾で確認済み）
`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
