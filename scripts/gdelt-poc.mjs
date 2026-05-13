#!/usr/bin/env node
// GDELT 2.0 API の PoC（v0.9.0 / get_geopolitical_pulse 設計用）。
//
// 目的:
//   1. 無料・APIキー不要で実際にデータが取れるかを検証
//   2. Doc 2.0 API の最適なクエリ構文とレート制限の挙動を把握
//   3. Events 2.0 CSV（CAMEO イベント DB）と Doc 2.0 のどちらを採用すべきか判定
//   4. 出力スキーマ設計に必要なフィールドの実物を確認
//
// 実行:
//   node scripts/gdelt-poc.mjs
// 環境変数:
//   GDELT_POC_TIMESPAN=24h など Doc API の timespan を上書き可能（既定 24h）
//   GDELT_POC_MAX=10 で取得件数を上書き可能（既定 10）

const TIMESPAN = process.env.GDELT_POC_TIMESPAN ?? "24h";
const MAX = parseInt(process.env.GDELT_POC_MAX ?? "20", 10);
const SLEEP_MS = parseInt(process.env.GDELT_POC_SLEEP_MS ?? "3000", 10);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchDocArtList(query, extraParams = {}) {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "ArtList");
  url.searchParams.set("format", "json");
  url.searchParams.set("timespan", TIMESPAN);
  url.searchParams.set("maxrecords", String(MAX));
  url.searchParams.set("sort", "DateDesc");
  for (const [k, v] of Object.entries(extraParams)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { "User-Agent": "lit-forge-mcp-poc/0.0.1" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} (url=${url})`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _rawPreview: text.slice(0, 300), _parseError: true };
  }
}

async function probe(label, queryOrFn) {
  console.log(`\n--- ${label} ---`);
  try {
    const result = typeof queryOrFn === "function" ? await queryOrFn() : await fetchDocArtList(queryOrFn);
    if (result._parseError) {
      console.log(`  ⚠️ JSON 解析失敗。生レスポンス先頭:`);
      console.log(`  ${result._rawPreview}`);
      return;
    }
    const articles = result.articles ?? [];
    console.log(`  取得記事: ${articles.length} 件`);
    for (const a of articles.slice(0, 5)) {
      console.log(`  [${a.seendate ?? "?"}] ${a.title ?? "(no title)"}`);
      console.log(`    domain=${a.domain ?? "?"} country=${a.sourcecountry ?? "?"}`);
    }
    if (articles.length > 0) {
      console.log(`  fields:`, Object.keys(articles[0]).join(", "));
    }
  } catch (e) {
    console.log(`  ❌ ${e.message}`);
  }
}

// ----- Events 2.0 CSV: lastupdate.txt 取得 + 件数概算 -----
async function probeEvents() {
  console.log("\n--- Events 2.0 (CAMEO イベント DB) ---");
  try {
    const res = await fetch("http://data.gdeltproject.org/gdeltv2/lastupdate.txt", {
      headers: { "User-Agent": "lit-forge-mcp-poc/0.0.1" },
      signal: AbortSignal.timeout(10000),
    });
    const lines = (await res.text()).trim().split("\n");
    console.log(`  lastupdate.txt:`);
    for (const l of lines) console.log(`    ${l}`);
    const eventsLine = lines.find((l) => l.includes(".export.CSV.zip"));
    if (!eventsLine) {
      console.log(`  ⚠️ events 行が見つからない`);
      return;
    }
    const [size, _md5, csvUrl] = eventsLine.split(" ");
    console.log(`  events CSV: size=${size} bytes  url=${csvUrl}`);
    console.log(`  → ZIP 解凍が必要（adm-zip 等の依存追加 or system unzip）`);
    console.log(`  → CAMEO Event Code / GoldsteinScale / NumMentions / AvgTone / Actor1/2 等が含まれる`);
    console.log(`  → 1 ファイル 15 分窓で約 3 万件、フィルタで 数十件に絞り込む想定`);
  } catch (e) {
    console.log(`  ❌ ${e.message}`);
  }
}

async function main() {
  console.log("=".repeat(70));
  console.log("GDELT PoC — lit-forge-mcp v0.9.0 設計検証");
  console.log("=".repeat(70));
  console.log(`timespan=${TIMESPAN}  max=${MAX}  sleep=${SLEEP_MS}ms`);

  // 1: 最も単純なテキストクエリ（base case）
  await probe('Test 1: 単純テキスト "Trump China"', 'Trump China');
  await sleep(SLEEP_MS);

  // 2: ソース国 + 言語フィルタ
  await probe(
    'Test 2: sourcecountry:US + sourcelang:eng + "China trade"',
    'China trade sourcecountry:US sourcelang:eng',
  );
  await sleep(SLEEP_MS);

  // 3: イラン・ホルムズ
  await probe(
    'Test 3: Iran Hormuz strait',
    '(Iran OR Hormuz) sourcelang:eng',
  );
  await sleep(SLEEP_MS);

  // 4: ウクライナ和平
  await probe(
    'Test 4: Ukraine ceasefire',
    'Ukraine ceasefire sourcelang:eng',
  );
  await sleep(SLEEP_MS);

  // 5: テーマフィルタ（GKG theme:）
  await probe(
    'Test 5: theme:TAX_FNCACT_TRADE + China',
    'theme:TAX_FNCACT_TRADE China sourcelang:eng',
  );
  await sleep(SLEEP_MS);

  // 6: ToneChart モード（記事のトーン分布）
  await probe('Test 6: ToneChart mode for "Trump Xi"', async () => {
    const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
    url.searchParams.set("query", "Trump Xi sourcelang:eng");
    url.searchParams.set("mode", "ToneChart");
    url.searchParams.set("format", "json");
    url.searchParams.set("timespan", TIMESPAN);
    const res = await fetch(url, {
      headers: { "User-Agent": "lit-forge-mcp-poc/0.0.1" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log(`  tonechart bins:`, JSON.stringify(data.tonechart?.slice(0, 5) ?? data, null, 2).slice(0, 400));
    return { articles: [] };
  });
  await sleep(SLEEP_MS);

  // 7: Events 2.0 CSV
  await probeEvents();

  console.log("\n" + "=".repeat(70));
  console.log("PoC 完了");
  console.log("=".repeat(70));
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
