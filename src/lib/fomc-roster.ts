// 現年（2026）FOMC メンバー対応表。
// get_central_bank_speakers が ForexFactory フィードの「FOMC Member <名字> Speaks」を
// 役職（日本語）と投票権の有無で enrich するための辞書。FF は名字 + "FOMC Member" しか持たないため、
// 「投票権あり / ダラス連銀総裁」といった粒度はこの表で補完する。
//
// ⚠️ 投票メンバーは毎年 1 月にローテーションするので、年初に必ず更新すること。
//    地区連銀総裁の交代（新任・暫定）も随時反映する。訓練データのハードコードは禁止
//    （現職漏れ事故の前例あり）。一次ソースで現職を確認してから更新する。
//
// 一次ソース: https://www.federalreserve.gov/monetarypolicy/fomc.htm （FOMC 構成・当年の投票ローテーション）
// 2026 ローテーション根拠: 入り=Paulson(Phil)/Hammack(Cle)/Logan(Dal)/Kashkari(Min)、
//   抜け=Collins(Bos)/Goolsbee(Chi)/Musalem(StL)/Schmid(KC)。
//
// FOMC 投票権の規則: 理事 7 名は常に投票 + NY 連銀総裁は常任 + 残り 11 地区連銀総裁から 4 名が 1 年交代。

export const FOMC_ROSTER_YEAR = 2026;
export const FOMC_ROSTER_LAST_VERIFIED = "2026-05-27";
export const FOMC_ROSTER_SOURCE =
  "https://www.federalreserve.gov/monetarypolicy/fomc.htm";

export type FomcKind = "governor" | "regional";

export type FomcMember = {
  // FF タイトル末尾に出る名字（小文字キー）と一致させる
  surname: string;
  // 日本語の役職ラベル（FRB議長 / FRB理事 / ダラス連銀総裁 等）
  roleJa: string;
  kind: FomcKind;
  // 当年（FOMC_ROSTER_YEAR）の投票権
  votingMember: boolean;
  // 議長・副議長などの筆頭格フラグ（importance 引き上げ用）
  isChair?: boolean;
};

// キーは小文字の名字。FF が "FOMC Member Logan Speaks" のように名字だけを出すため。
export const FOMC_ROSTER: Readonly<Record<string, FomcMember>> = {
  // ── 理事（Board of Governors）7 名: 常に投票 ──
  warsh: { surname: "Warsh", roleJa: "FRB議長", kind: "governor", votingMember: true, isChair: true },
  barr: { surname: "Barr", roleJa: "FRB理事", kind: "governor", votingMember: true },
  bowman: { surname: "Bowman", roleJa: "FRB理事", kind: "governor", votingMember: true },
  cook: { surname: "Cook", roleJa: "FRB理事", kind: "governor", votingMember: true },
  jefferson: { surname: "Jefferson", roleJa: "FRB理事", kind: "governor", votingMember: true },
  powell: { surname: "Powell", roleJa: "FRB理事", kind: "governor", votingMember: true },
  waller: { surname: "Waller", roleJa: "FRB理事", kind: "governor", votingMember: true },

  // ── 地区連銀総裁: NY は常任、ほか 4 名が 2026 投票 ──
  williams: { surname: "Williams", roleJa: "NY連銀総裁", kind: "regional", votingMember: true },
  paulson: { surname: "Paulson", roleJa: "フィラデルフィア連銀総裁", kind: "regional", votingMember: true },
  hammack: { surname: "Hammack", roleJa: "クリーブランド連銀総裁", kind: "regional", votingMember: true },
  logan: { surname: "Logan", roleJa: "ダラス連銀総裁", kind: "regional", votingMember: true },
  kashkari: { surname: "Kashkari", roleJa: "ミネアポリス連銀総裁", kind: "regional", votingMember: true },

  // ── 地区連銀総裁: 2026 非投票（ローテーション外） ──
  collins: { surname: "Collins", roleJa: "ボストン連銀総裁", kind: "regional", votingMember: false },
  goolsbee: { surname: "Goolsbee", roleJa: "シカゴ連銀総裁", kind: "regional", votingMember: false },
  musalem: { surname: "Musalem", roleJa: "セントルイス連銀総裁", kind: "regional", votingMember: false },
  schmid: { surname: "Schmid", roleJa: "カンザスシティ連銀総裁", kind: "regional", votingMember: false },
  barkin: { surname: "Barkin", roleJa: "リッチモンド連銀総裁", kind: "regional", votingMember: false },
  daly: { surname: "Daly", roleJa: "サンフランシスコ連銀総裁", kind: "regional", votingMember: false },
  // ⚠️ アトランタは暫定総裁（Venable）。交代があり得るため要確認。
  venable: { surname: "Venable", roleJa: "アトランタ連銀総裁（暫定）", kind: "regional", votingMember: false },
};

// 名字から FOMC メンバー情報を引く（大文字小文字を無視）。未登録なら undefined。
export function lookupFomcMember(surname: string): FomcMember | undefined {
  return FOMC_ROSTER[surname.trim().toLowerCase()];
}
