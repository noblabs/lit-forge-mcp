#!/usr/bin/env node
// 中銀イベント照合スクリプト。
// ECONOMIC_EVENTS（src/lib/economic-events.ts → dist/lib/economic-events.js）の中銀イベントを、
// data/central-bank-schedules/*.json の公式日程と突合する。
//
// 目的: 2026-05-11 に発生した「日銀 議事要旨 5/11 (実際は 5/12 主な意見)」のような
// 種別取り違え + 日付ズレを再発防止する。vitest の形式チェックでは捕捉不能なため。
//
// 比較ルール:
//   - 中銀イベント = name が「日銀」「FOMC」「FRB 議長」「ECB」のいずれかを含むエントリ
//   - 比較キー: `${date}|${time ?? ""}|${name}` ⇔ `${publishDate}|${publishTime ?? ""}|${label}`
//   - TS ⊆ JSON（TS の中銀エントリは全て JSON にあること）→ 違反は exit 1
//   - JSON 側に余剰がある場合は警告のみ（網羅性は別途半年更新時にフォロー）
//   - lastSyncedAt が 180 日超なら警告のみ
//   - tentative=true のエントリが予定日を過ぎたまま残っていたら警告のみ（実公開日の確定更新を促す）
//
// 前提: `npm run build` が完了し dist/lib/economic-events.js が存在すること。

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

const SOURCES = [
  { name: "BOJ", file: "data/central-bank-schedules/boj.json" },
  { name: "FOMC", file: "data/central-bank-schedules/fomc.json" },
  { name: "ECB", file: "data/central-bank-schedules/ecb.json" },
];

// 中銀イベント判定: name にこれらキーワードのいずれかを含む。
const CENTRAL_BANK_KEYWORDS = ["日銀", "FOMC", "FRB 議長", "ECB"];

const FRESHNESS_WARN_DAYS = 180;

// tentative（予定）エントリが予定日を過ぎてからこの日数を超えると警告する猶予。
const TENTATIVE_GRACE_DAYS = 3;

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

function isCentralBankEvent(name) {
  return CENTRAL_BANK_KEYWORDS.some((kw) => name.includes(kw));
}

function daysSince(isoDate) {
  const then = new Date(`${isoDate}T00:00:00+09:00`).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (24 * 3600 * 1000));
}

async function main() {
  // dist 側を ESM dynamic import で読む（tsc 後の前提）。
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
    // 鮮度チェック。
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
      // tentative エントリ（FOMC 議事要旨など Fed 未告知の計算値）の期限切れ警告。
      // 予定日 publishDate を TENTATIVE_GRACE_DAYS 超で過ぎても tentative のままなら、
      // 実公開日が確定しているはずなので公式裏取り + tentative 解除を促す。
      if (ev.tentative === true && daysSince(ev.publishDate) > TENTATIVE_GRACE_DAYS) {
        console.warn(
          `[WARN] ${src.name} の tentative エントリ「${ev.label}」(予定 ${ev.publishDate}) が ${daysSince(ev.publishDate)} 日前を過ぎています。Fed 公式で実公開日を確認し、確定値に更新して tentative を外してください。`,
        );
      }
    }
  }

  // TS 中銀エントリ抽出。
  const tsCentralBank = ECONOMIC_EVENTS.filter((e) => isCentralBankEvent(e.name));
  const missing = [];
  for (const e of tsCentralBank) {
    const key = makeKey(e.date, e.time, e.name);
    if (!jsonKeys.has(key)) {
      missing.push(e);
    }
  }

  // JSON 側余剰（参考表示）。
  const tsKeys = new Set(
    tsCentralBank.map((e) => makeKey(e.date, e.time, e.name)),
  );
  const jsonExtras = [...jsonKeys].filter((k) => !tsKeys.has(k));

  console.log(
    `[INFO] TS 中銀エントリ ${tsCentralBank.length} 件 / JSON 公式日程 ${jsonTotal} 件`,
  );

  if (missing.length > 0) {
    console.error(
      `\n[FAIL] 公式日程 JSON に存在しない TS 中銀エントリが ${missing.length} 件:`,
    );
    for (const e of missing) {
      console.error(
        `  - ${e.date} ${e.time ?? "(終日)"} ★${e.importance} ${e.name}`,
      );
    }
    console.error(
      `\n対処: data/central-bank-schedules/{boj,fomc,ecb}.json を公式日程から更新するか、TS 側のエントリを削除/修正してください。`,
    );
    process.exit(1);
  }

  if (jsonExtras.length > 0) {
    console.log(
      `\n[INFO] JSON 公式日程にあるが TS に未登録の中銀イベント ${jsonExtras.length} 件 (網羅性の参考):`,
    );
    for (const k of jsonExtras.slice(0, 20)) {
      console.log(`  - ${k}`);
    }
    if (jsonExtras.length > 20) {
      console.log(`  ... 他 ${jsonExtras.length - 20} 件`);
    }
  }

  console.log(`\n[OK] ${SOURCES.length} sources / ${tsCentralBank.length} TS 中銀エントリ matched`);
}

main().catch((err) => {
  console.error(`[FATAL] ${err.stack ?? err}`);
  process.exit(1);
});
