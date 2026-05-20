// DOL/ETA 新規失業保険申請件数アダプタ（v0.15.0 新設）。
//
// 米労働省 ETA（Employment and Training Administration）が毎週木曜 08:30 ET に
// 公表する Unemployment Insurance Weekly Claims（新規失業保険申請件数）の発表予定を返す。
// 発表元は BLS ではなく DOL/ETA で、pulse の既存アダプタ（BEA/NY 連銀/FRB/BLS(PFEI)/内閣府/日銀）の
// いずれもカバーしておらず、網羅性の穴になっていた（2026-05-21 取りこぼし）。
//
// 設計:
//   - 週次・毎週木曜という規則性が高いため、PFEI のような長大な転記データではなく
//     「木曜を計算で生成」する方式（HTTP なし・常時成功）。
//   - DOL の運用上、木曜が連邦祝日に当たる週は発表日がずれる（感謝祭週は前日水曜へ前倒し等）。
//     その例外のみ JOBLESS_CLAIMS_OVERRIDES で補正する。
//   - 08:30 ET → JST（DST 期間 21:30 / 標準時 22:30、同日内）は既存 etToJst を再利用。

import type { ReleaseAdapter, ReleaseEvent } from "../types.js";
import { etToJst, jstDatePlus } from "../util.js";

// 新規失業保険申請件数の公表時刻（ET）。
const RELEASE_TIME_ET = "08:30";
// 一次ソース（毎週の News Release PDF）。
const DOL_CLAIMS_URL = "https://www.dol.gov/ui/data.pdf";

// 連邦祝日で木曜発表がずれる週のオーバーライド。
// キー = 通常の木曜（ET 日付）、値 = 実際の発表日（ET 日付）。
// DOL 運用: 「木曜が連邦祝日に当たる週」は発表日が変わる。
// ⚠️ 半年に 1 回 DOL 公式日程（https://oui.doleta.gov/unemploy/claims.asp）で要確認・追記。
const JOBLESS_CLAIMS_OVERRIDES: Readonly<Record<string, string>> = {
  // 感謝祭（4th Thu = 2026-11-26、連邦祝日）週は前日水曜に前倒し公表。
  "2026-11-26": "2026-11-25",
};

function ymdToUtc(ymdStr: string): Date {
  const [y, m, d] = ymdStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function utcToYmd(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

// [fromEtYmd, toEtYmd]（ET 日付・両端含む）の範囲で、新規失業保険申請件数の
// 発表予定を ReleaseEvent[] に展開する純関数（テスト用 export）。
// 各週の木曜を生成し、祝日オーバーライドを適用して実際の発表日に補正する。
export function computeJoblessClaimsReleases(
  fromEtYmd: string,
  toEtYmd: string,
): ReleaseEvent[] {
  const from = ymdToUtc(fromEtYmd);
  const to = ymdToUtc(toEtYmd);
  const out: ReleaseEvent[] = [];

  // オーバーライドで前後にずれた発表日も拾えるよう、開始を 1 週前にパディング。
  const cursor = new Date(from);
  cursor.setUTCDate(cursor.getUTCDate() - 7);
  // 最初の木曜（getUTCDay: 0=日..4=木..6=土）まで進める。
  cursor.setUTCDate(cursor.getUTCDate() + ((4 - cursor.getUTCDay() + 7) % 7));

  // to から十分後ろまで木曜を走査（オーバーライドの後ろずれにも対応）。
  const scanEnd = new Date(to);
  scanEnd.setUTCDate(scanEnd.getUTCDate() + 7);

  while (cursor <= scanEnd) {
    const thursdayEtYmd = utcToYmd(cursor);
    const actualEtYmd = JOBLESS_CLAIMS_OVERRIDES[thursdayEtYmd] ?? thursdayEtYmd;
    const actual = ymdToUtc(actualEtYmd);
    if (actual >= from && actual <= to) {
      const { date, time } = etToJst(actualEtYmd, RELEASE_TIME_ET);
      out.push({
        date,
        time,
        country: "US",
        name: "米 新規失業保険申請件数",
        source: "DOL/ETA",
        sourceUrl: DOL_CLAIMS_URL,
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return out;
}

export const dolEtaAdapter: ReleaseAdapter = {
  key: "dol-eta",
  label: "DOL/ETA（新規失業保険申請件数・週次）",
  fetchEvents: async () => {
    // pulse 側が today/week でフィルタするため、現在を中心に広めの窓で計算する。
    const now = new Date();
    return computeJoblessClaimsReleases(
      jstDatePlus(-10, now),
      jstDatePlus(21, now),
    );
  },
};
