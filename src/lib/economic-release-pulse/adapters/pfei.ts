// PFEI アダプタ（v0.14.0 新設）。
//
// ホワイトハウス (OMB/OIRA) が年初に公開する Principal Federal Economic
// Indicators の Schedule PDF を一次ソースに、BLS 三大指標
// (雇用統計・CPI・PPI) の年間発表予定を ReleaseEvent[] に展開する。
//
// 設計背景:
//   - BLS 公式の HTML schedule と RSS は Akamai bot 管理で 403 を返すため
//     直接の自動取得は不可能（[[feedback_lit_forge_mcp_bls_access_constraint]]）。
//   - ホワイトハウスの PFEI PDF は bot ブロックなしで取得でき、米連邦経済指標の
//     全主要発表予定を一括カバーする。
//   - PDF パースは scripts/update-pfei-schedule.mjs が運営マシン側で実行し、
//     結果を src/lib/pfei-schedule-data.ts に TS として焼き込む。
//     MCP サーバはランタイムで PDF を取りに行かないため bot ブロックの影響を受けない。
//   - 年初 (1 月) や PFEI 改訂時に再実行して上書きする運用。
//
// 他アダプタ (BEA / NY 連銀 / FRB) と違い HTTP fetch を行わず、ビルド時に
// 焼き込まれた静的データを返すだけなのでキャッシュ不要・常に成功扱い。

import type { ReleaseAdapter, ReleaseEvent } from "../types.js";
import { etToJst } from "../util.js";
import { PFEI_SCHEDULES } from "../../pfei-schedule-data.js";

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// PFEI スケジュールデータを ReleaseEvent[] に展開する純関数（テスト用 export）。
export function pfeiToReleaseEvents(): ReleaseEvent[] {
  const out: ReleaseEvent[] = [];
  for (const schedule of PFEI_SCHEDULES) {
    for (const ind of schedule.indicators) {
      for (const r of ind.releases) {
        const ymdEt = ymd(schedule.year, r.month, r.day);
        const { date, time } = etToJst(ymdEt, ind.timeEt);
        out.push({
          date,
          time,
          country: "US",
          name: ind.name,
          source: "BLS (via PFEI)",
          sourceUrl: schedule.sourceUrl,
        });
      }
    }
  }
  return out;
}

export const pfeiAdapter: ReleaseAdapter = {
  key: "pfei",
  label: "BLS（PFEI 公式スケジュール: 雇用統計・CPI・PPI）",
  fetchEvents: async () => pfeiToReleaseEvents(),
};
