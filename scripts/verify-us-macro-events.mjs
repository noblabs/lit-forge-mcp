#!/usr/bin/env node
// 米マクロ指標イベント照合スクリプト。
// ECONOMIC_EVENTS（src/lib/economic-events.ts → dist/lib/economic-events.js）の
// BLS/BEA/Census 系イベントを、data/us-macro-schedule/*.json の公式日程と突合する。
//
// 目的: 2026-05-12 に発生した「米 CPI（4 月）5/13 (実際は 5/12)」のような
// 日付ズレ事故の再発防止。PPI/PCE/小売売上高/GDP/雇用統計も同様の系統誤りが連鎖していた。
//
// 比較ルール:
//   - 対象 = name が「米 CPI」「米 PPI」「米 雇用統計」「米 小売売上高」「米 PCE」「米 GDP 速報」のいずれかを含むエントリ
//     ※ ISM は ismworld.org が認証ウォール内のため別途扱い（本スクリプトの対象外）
//   - 比較キー: `${date}|${time ?? ""}|${name}` ⇔ `${publishDate}|${publishTime ?? ""}|${label}`
//   - TS ⊆ JSON（TS のマクロ指標エントリは全て JSON にあること）→ 違反は exit 1
//   - JSON 側に余剰がある場合は参考表示のみ（網羅性は別途半年更新時にフォロー）
//   - lastSyncedAt が 180 日超なら警告
//
// 前提: `npm run build` が完了し dist/lib/economic-events.js が存在すること。

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

const SOURCES = [
  { name: "CPI", file: "data/us-macro-schedule/cpi.json" },
  { name: "PPI", file: "data/us-macro-schedule/ppi.json" },
  { name: "Employment", file: "data/us-macro-schedule/employment.json" },
  { name: "Retail Sales", file: "data/us-macro-schedule/retail-sales.json" },
  { name: "PCE", file: "data/us-macro-schedule/pce.json" },
  { name: "GDP", file: "data/us-macro-schedule/gdp.json" },
];

// 対象イベント判定: name にこれらキーワードのいずれかを含む。
// ISM は出典が認証ウォールのため対象外（将来 ism.json を追加可能）。
const TARGET_KEYWORDS = [
  "米 CPI",
  "米 PPI",
  "米 雇用統計",
  "米 小売売上高",
  "米 PCE",
  "米 GDP 速報",
];

const FRESHNESS_WARN_DAYS = 180;

function loadJson(relPath) {
  const fullPath = join(REPO_ROOT, relPath);
  try {
    return JSON.parse(readFileSync(fullPath, "utf-8"));
  } catch (err) {
    console.error(`[ERROR] ${relPath} 読み込み失敗: ${err.message}`);
    process.exit(1);
  }
}

function makeKey(date, time, label) {
  return `${date}|${time ?? ""}|${label}`;
}

function isTargetEvent(name) {
  return TARGET_KEYWORDS.some((kw) => name.includes(kw));
}

function daysSince(isoDate) {
  const then = new Date(`${isoDate}T00:00:00+09:00`).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (24 * 3600 * 1000));
}

async function main() {
  const distPath = join(REPO_ROOT, "dist/lib/economic-events.js");
  let ECONOMIC_EVENTS;
  try {
    ({ ECONOMIC_EVENTS } = await import(distPath));
  } catch (err) {
    console.error(
      `[ERROR] dist/lib/economic-events.js が読み込めません。先に 'npm run build' を実行してください。\n  詳細: ${err.message}`,
    );
    process.exit(1);
  }

  // JSON 側のキーを集約。
  const jsonKeys = new Set();
  let jsonTotal = 0;
  for (const src of SOURCES) {
    const data = loadJson(src.file);
    if (!Array.isArray(data.events)) {
      console.error(`[ERROR] ${src.file} に events 配列がありません`);
      process.exit(1);
    }
    if (data.lastSyncedAt) {
      const age = daysSince(data.lastSyncedAt);
      if (age > FRESHNESS_WARN_DAYS) {
        console.warn(
          `[WARN] ${src.name} (${src.file}) の lastSyncedAt が ${age} 日前 (>${FRESHNESS_WARN_DAYS}日)。公式から再同期してください。`,
        );
      }
    } else {
      console.warn(`[WARN] ${src.file} に lastSyncedAt がありません`);
    }
    for (const ev of data.events) {
      jsonKeys.add(makeKey(ev.publishDate, ev.publishTime, ev.label));
      jsonTotal++;
    }
  }

  // TS 対象エントリ抽出。
  const tsTargets = ECONOMIC_EVENTS.filter((e) => isTargetEvent(e.name));
  const missing = [];
  for (const e of tsTargets) {
    const key = makeKey(e.date, e.time, e.name);
    if (!jsonKeys.has(key)) {
      missing.push(e);
    }
  }

  // JSON 側余剰（参考表示）。
  const tsKeys = new Set(tsTargets.map((e) => makeKey(e.date, e.time, e.name)));
  const jsonExtras = [...jsonKeys].filter((k) => !tsKeys.has(k));

  console.log(
    `[INFO] TS 米マクロ指標エントリ ${tsTargets.length} 件 / JSON 公式日程 ${jsonTotal} 件`,
  );

  if (missing.length > 0) {
    console.error(
      `\n[FAIL] 公式日程 JSON に存在しない TS 米マクロ指標エントリが ${missing.length} 件:`,
    );
    for (const e of missing) {
      console.error(
        `  - ${e.date} ${e.time ?? "(終日)"} ★${e.importance} ${e.name}`,
      );
    }
    console.error(
      `\n対処: data/us-macro-schedule/*.json を PFEI 等公式日程から更新するか、TS 側のエントリを削除/修正してください。`,
    );
    process.exit(1);
  }

  if (jsonExtras.length > 0) {
    console.log(
      `\n[INFO] JSON 公式日程にあるが TS に未登録のイベント ${jsonExtras.length} 件 (網羅性の参考):`,
    );
    for (const k of jsonExtras.slice(0, 20)) {
      console.log(`  - ${k}`);
    }
    if (jsonExtras.length > 20) {
      console.log(`  ... 他 ${jsonExtras.length - 20} 件`);
    }
  }

  console.log(`\n[OK] ${SOURCES.length} sources / ${tsTargets.length} TS 米マクロ指標エントリ matched`);
}

main().catch((err) => {
  console.error(`[FATAL] ${err.stack ?? err}`);
  process.exit(1);
});
