#!/usr/bin/env node
// 地政学イベント照合スクリプト（v0.8.0 新設）。
// GEOPOLITICAL_EVENTS（src/lib/geopolitical-events.ts → dist/lib/geopolitical-events.js）を
// data/geopolitical-events/*.json と突合する。
//
// 中銀 verify と同じ TS⊆JSON の一方向検証だが、地政学は表記揺れが起きやすいため
// 比較キーを id 単一に固定し、publishDate / label の不一致は別 error として報告する。
//
// 検証ルール:
//   - 比較キー: TS の id ⇔ JSON の id（完全一致）
//   - TS ⊆ JSON: TS の各エントリの id が JSON 側に存在すること → 違反は exit 1
//   - 同じ id で publishDate / publishEndDate / label が食い違っていたら error
//   - 必須フィールド: JSON 側に sourceUrl 非空 / lastVerifiedAt が YYYY-MM-DD / source が enum 値
//   - 一次ソース比率: JSON 側エントリの 30% 超が source: "private" のみだったら warn
//   - lastSyncedAt が 180 日超なら warn（中銀と同じ）

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

const SOURCES = [
  { name: "summits", file: "data/geopolitical-events/summits.json" },
  { name: "bilateral", file: "data/geopolitical-events/bilateral-meetings.json" },
  { name: "elections", file: "data/geopolitical-events/elections.json" },
  { name: "risk", file: "data/geopolitical-events/risk-events.json" },
];

const FRESHNESS_WARN_DAYS = 180;
const PRIVATE_ONLY_WARN_RATIO = 0.3;
const VALID_SOURCES = new Set(["official-jp", "official-intl", "private"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function loadJson(relPath) {
  const fullPath = join(REPO_ROOT, relPath);
  try {
    return JSON.parse(readFileSync(fullPath, "utf-8"));
  } catch (err) {
    console.error(`[ERROR] ${relPath} 読み込み失敗: ${err.message}`);
    process.exit(1);
  }
}

function daysSince(isoDate) {
  const then = new Date(`${isoDate}T00:00:00+09:00`).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (24 * 3600 * 1000));
}

async function main() {
  const distPath = join(REPO_ROOT, "dist/lib/geopolitical-events.js");
  let GEOPOLITICAL_EVENTS;
  try {
    ({ GEOPOLITICAL_EVENTS } = await import(distPath));
  } catch (err) {
    console.error(
      `[ERROR] dist/lib/geopolitical-events.js が読み込めません。先に 'npm run build' を実行してください。\n  詳細: ${err.message}`,
    );
    process.exit(1);
  }

  // JSON 側のエントリを id 索引化。
  const jsonById = new Map();
  let jsonTotal = 0;
  let privateOnlyCount = 0;
  const fieldErrors = [];

  for (const src of SOURCES) {
    const data = loadJson(src.file);
    if (!Array.isArray(data.events)) {
      console.error(`[ERROR] ${src.file} に events 配列がありません`);
      process.exit(1);
    }
    // 鮮度チェック。
    if (data.lastSyncedAt) {
      const age = daysSince(data.lastSyncedAt);
      if (age > FRESHNESS_WARN_DAYS) {
        console.warn(
          `[WARN] ${src.name} (${src.file}) の lastSyncedAt が ${age} 日前 (>${FRESHNESS_WARN_DAYS}日)。一次ソースから再同期してください。`,
        );
      }
    } else {
      console.warn(`[WARN] ${src.file} に lastSyncedAt がありません`);
    }

    for (const ev of data.events) {
      jsonTotal++;
      // 必須フィールド検証。
      if (!ev.id || typeof ev.id !== "string") {
        fieldErrors.push(`${src.file}: id が欠落 or 不正 (${JSON.stringify(ev).slice(0, 80)}...)`);
        continue;
      }
      if (jsonById.has(ev.id)) {
        fieldErrors.push(`${src.file}: id が重複 (${ev.id})`);
      }
      if (!ev.sourceUrl || typeof ev.sourceUrl !== "string" || ev.sourceUrl.trim() === "") {
        fieldErrors.push(`${src.file} [${ev.id}]: sourceUrl が空`);
      }
      if (!ev.lastVerifiedAt || !DATE_RE.test(ev.lastVerifiedAt)) {
        fieldErrors.push(`${src.file} [${ev.id}]: lastVerifiedAt が YYYY-MM-DD 形式でない`);
      }
      if (!VALID_SOURCES.has(ev.source)) {
        fieldErrors.push(
          `${src.file} [${ev.id}]: source が enum 外 (${ev.source}). 許容値: ${[...VALID_SOURCES].join(", ")}`,
        );
      }
      if (ev.source === "private") {
        privateOnlyCount++;
      }
      jsonById.set(ev.id, { ...ev, _srcFile: src.file });
    }
  }

  if (fieldErrors.length > 0) {
    console.error(`\n[FAIL] JSON 必須フィールド検証エラー ${fieldErrors.length} 件:`);
    for (const msg of fieldErrors) {
      console.error(`  - ${msg}`);
    }
    process.exit(1);
  }

  // TS 全エントリを id で照合。
  const missing = [];
  const mismatched = [];
  for (const e of GEOPOLITICAL_EVENTS) {
    const j = jsonById.get(e.id);
    if (!j) {
      missing.push(e);
      continue;
    }
    if (j.publishDate !== e.date) {
      mismatched.push(`${e.id}: TS date=${e.date} ≠ JSON publishDate=${j.publishDate}`);
    }
    const tsEnd = e.endDate ?? null;
    const jsonEnd = j.publishEndDate ?? null;
    if (tsEnd !== jsonEnd) {
      mismatched.push(`${e.id}: TS endDate=${tsEnd} ≠ JSON publishEndDate=${jsonEnd}`);
    }
    if (j.label !== e.name) {
      mismatched.push(`${e.id}: TS name=${e.name} ≠ JSON label=${j.label}`);
    }
  }

  // TS 側 id の重複検出。
  const tsIds = new Set();
  const tsDupes = [];
  for (const e of GEOPOLITICAL_EVENTS) {
    if (tsIds.has(e.id)) tsDupes.push(e.id);
    tsIds.add(e.id);
  }

  console.log(
    `[INFO] TS 地政学エントリ ${GEOPOLITICAL_EVENTS.length} 件 / JSON 公式日程 ${jsonTotal} 件`,
  );

  if (tsDupes.length > 0) {
    console.error(`\n[FAIL] TS 側 id 重複 ${tsDupes.length} 件: ${tsDupes.join(", ")}`);
    process.exit(1);
  }

  if (missing.length > 0) {
    console.error(
      `\n[FAIL] 公式日程 JSON に存在しない TS 地政学エントリが ${missing.length} 件:`,
    );
    for (const e of missing) {
      console.error(`  - id=${e.id} ${e.date} ★${e.importance} ${e.name}`);
    }
    console.error(
      `\n対処: data/geopolitical-events/*.json に同じ id でエントリを追加するか、TS 側を削除/修正してください。`,
    );
    process.exit(1);
  }

  if (mismatched.length > 0) {
    console.error(
      `\n[FAIL] 同一 id で TS と JSON のフィールドが食い違うエントリが ${mismatched.length} 件:`,
    );
    for (const msg of mismatched) {
      console.error(`  - ${msg}`);
    }
    process.exit(1);
  }

  // 一次ソース比率の警告。
  if (jsonTotal > 0) {
    const ratio = privateOnlyCount / jsonTotal;
    if (ratio > PRIVATE_ONLY_WARN_RATIO) {
      console.warn(
        `\n[WARN] source: "private" のエントリが ${privateOnlyCount}/${jsonTotal} 件 (${(ratio * 100).toFixed(0)}%) で ${PRIVATE_ONLY_WARN_RATIO * 100}% を超過。一次ソース（official-jp / official-intl）の併用を増やしてください。`,
      );
    }
  }

  // JSON 側余剰（参考表示）。
  const jsonExtras = [...jsonById.keys()].filter((id) => !tsIds.has(id));
  if (jsonExtras.length > 0) {
    console.log(
      `\n[INFO] JSON 公式日程にあるが TS に未登録の地政学イベント ${jsonExtras.length} 件 (網羅性の参考):`,
    );
    for (const id of jsonExtras.slice(0, 20)) {
      console.log(`  - ${id}`);
    }
    if (jsonExtras.length > 20) {
      console.log(`  ... 他 ${jsonExtras.length - 20} 件`);
    }
  }

  console.log(
    `\n[OK] ${SOURCES.length} sources / ${GEOPOLITICAL_EVENTS.length} TS 地政学エントリ matched`,
  );
}

main().catch((err) => {
  console.error(`[FATAL] ${err.stack ?? err}`);
  process.exit(1);
});
