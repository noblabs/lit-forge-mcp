#!/usr/bin/env node
// PFEI スケジュール JSON 更新スクリプト（v0.14.0 新設）。
//
// ホワイトハウス (OMB/OIRA) が年初に公開する "Schedule of Release Dates for
// Principal Federal Economic Indicators" PDF をダウンロード → pdftotext で
// テキスト化 → BLS 三大指標 (雇用統計・CPI・PPI) の年間スケジュールを
// src/lib/pfei-schedule-data.ts に TS ファイルとして書き出す。
//
// TS で書き出す理由: tsc は JSON を dist にコピーしないため、ランタイムで読みたい
// データは TS にして dist にコンパイル出力させる必要がある。
//
// 想定実行頻度: 年初 (1 月)、PFEI 改訂時 (政府閉鎖等の事後対応)。
// 通常運用では MCP サーバが JSON を読むだけで PDF 再取得は行わない。
//
// 依存: poppler-utils (pdftotext CLI)。インストール例:
//   apt: sudo apt install poppler-utils
//   brew: brew install poppler
//
// 前提: `npm run build` 済みで dist/lib/pfei-parser.js が存在すること。

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parsePfei } from "../dist/lib/pfei-parser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

// 年が変わったら URL を書き換えて実行。
// 過去年の PDF URL もホワイトハウスは保持しているため再取得可能。
const PFEI_URL =
  "https://www.whitehouse.gov/wp-content/uploads/2025/09/pfei_schedule_release_dates_cy2026.pdf";

async function main() {
  const tmp = mkdtempSync(join(tmpdir(), "pfei-"));
  const pdfPath = join(tmp, "pfei.pdf");
  const txtPath = join(tmp, "pfei.txt");

  console.log(`[1/3] download ${PFEI_URL}`);
  const res = await fetch(PFEI_URL);
  if (!res.ok) {
    console.error(`HTTP ${res.status}`);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(pdfPath, buf);
  console.log(`  saved ${buf.length} bytes`);

  console.log("[2/3] pdftotext -layout");
  try {
    execFileSync("pdftotext", ["-layout", pdfPath, txtPath]);
  } catch (e) {
    console.error("pdftotext not found. Install poppler-utils:");
    console.error("  apt: sudo apt install poppler-utils");
    console.error("  brew: brew install poppler");
    process.exit(1);
  }

  const text = readFileSync(txtPath, "utf-8");
  console.log("[3/3] parse + write TS");
  const data = parsePfei(text, PFEI_URL);

  // ランタイムで import するため src/lib/ 配下に TS として書き出す。
  // 複数年を扱う場合は配列にエントリ追加する運用（年単位の再実行で全上書き）。
  const outPath = join(REPO_ROOT, "src", "lib", "pfei-schedule-data.ts");
  const banner =
    `// PFEI スケジュールデータ。\n` +
    `// scripts/update-pfei-schedule.mjs により自動生成 (手動編集禁止)。\n` +
    `// 再生成: \`npm run build && node scripts/update-pfei-schedule.mjs\`\n\n` +
    `import type { PfeiSchedule } from "./pfei-parser.js";\n\n`;
  const body = `export const PFEI_SCHEDULES: ReadonlyArray<PfeiSchedule> = ${JSON.stringify([data], null, 2)};\n`;
  writeFileSync(outPath, banner + body);
  console.log(`  written ${outPath}`);
  for (const ind of data.indicators) {
    const sample = ind.releases
      .slice(0, 3)
      .map((r) => `${r.month}/${r.day}`)
      .join(", ");
    console.log(`  - ${ind.name}: ${ind.releases.length} releases (${sample}, ...)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
