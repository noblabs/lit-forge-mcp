// PFEI (Principal Federal Economic Indicators) スケジュール PDF のパーサー（v0.14.0 新設）。
//
// 背景: BLS は HTML schedule / RSS への bot アクセスを 403 で拒否しているため
//   ([[feedback_lit_forge_mcp_bls_access_constraint]])、米マクロ三大指標
//   (雇用統計・CPI・PPI) の発表予定を自動取得する道が長らく無かった。
//   ホワイトハウス (OMB/OIRA) が年初に公開する PFEI スケジュール PDF は
//   bot ブロックなしで取得でき、BLS/BEA/Census の全主要指標を一括カバーする。
//
// 本モジュールは pdftotext -layout で抽出したテキストを入力に取り、
// BLS 三大指標の年間スケジュールを構造化 JSON に変換する純関数を提供する。
// 実 PDF の取得と pdftotext 実行はテスト容易性のためここでは行わない
// (運用スクリプト scripts/update-pfei-schedule.mjs が責任を持つ)。

export type PfeiIndicator = {
  key: "employment" | "cpi" | "ppi";
  name: string; // 例: "米 雇用統計 (Employment Situation)"
  agency: "BLS";
  timeEt: string; // 例: "08:30" (BLS 三大指標は全て 08:30 ET 発表)
  dataDescription: string; // 例: "Data are for previous month"
  releases: Array<{ month: number; day: number }>; // 1-12 の月ごとに 1 件
};

export type PfeiSchedule = {
  year: number;
  source: string;
  sourceUrl: string;
  parsedAt: string;
  indicators: PfeiIndicator[];
};

const INDICATORS: ReadonlyArray<{
  key: PfeiIndicator["key"];
  label: string;
  name: string;
  agency: "BLS";
  timeEt: string;
}> = [
  {
    key: "employment",
    label: "The Employment Situation",
    name: "米 雇用統計 (Employment Situation)",
    agency: "BLS",
    timeEt: "08:30",
  },
  {
    key: "ppi",
    label: "Producer Price Indexes",
    name: "米 PPI (Producer Price Indexes)",
    agency: "BLS",
    timeEt: "08:30",
  },
  {
    key: "cpi",
    label: "Consumer Price Index",
    name: "米 CPI (Consumer Price Index)",
    agency: "BLS",
    timeEt: "08:30",
  },
];

// PFEI PDF を pdftotext -layout で抽出した text を入力に取り、
// BLS 三大指標の年間スケジュールを返す。
export function parsePfei(text: string, sourceUrl: string): PfeiSchedule {
  // 年は PDF タイトル "PRINCIPAL FEDERAL ECONOMIC INDICATORS FOR YYYY" から
  const yearMatch = text.match(
    /PRINCIPAL FEDERAL ECONOMIC INDICATORS FOR (\d{4})/,
  );
  if (!yearMatch) {
    throw new Error("year not found in PDF title");
  }
  const year = Number(yearMatch[1]);

  // BLS セクションを切り出す: "BUREAU OF LABOR STATISTICS" から次の主要省庁/部局ヘッダまで
  const blsStart = text.indexOf("BUREAU OF LABOR STATISTICS");
  if (blsStart < 0) {
    throw new Error("BLS section not found in PDF");
  }
  // 次の上位ヘッダ候補（経験的に PFEI に出る他部局名）
  const SECTION_BREAK = /\b(BUREAU OF ECONOMIC ANALYSIS|FEDERAL RESERVE|CENSUS BUREAU|OFFICE OF MANAGEMENT|DEPARTMENT OF TREASURY|ENERGY INFORMATION|NATIONAL AGRICULTURAL)\b/;
  // BLS ヘッダ自体にマッチしないよう少し進めてから検索
  const tail = text.slice(blsStart + "BUREAU OF LABOR STATISTICS".length);
  const breakRel = tail.search(SECTION_BREAK);
  const blsBlock =
    breakRel >= 0
      ? text.slice(blsStart, blsStart + "BUREAU OF LABOR STATISTICS".length + breakRel)
      : text.slice(blsStart);

  // 各指標ラベルの出現位置を全部拾い、文書順に並べ替えて区間切り出しの基準にする
  const positions = INDICATORS.map((ind) => ({
    ind,
    pos: blsBlock.indexOf(ind.label),
  }))
    .filter((p) => p.pos >= 0)
    .sort((a, b) => a.pos - b.pos);

  if (positions.length === 0) {
    throw new Error("no BLS indicators found in PDF");
  }

  const indicators: PfeiIndicator[] = [];
  for (let i = 0; i < positions.length; i++) {
    const { ind, pos } = positions[i];
    // 次の指標ラベルまでをこの指標のセグメントとする
    const nextPos = i + 1 < positions.length ? positions[i + 1].pos : blsBlock.length;
    const segment = blsBlock.slice(pos, nextPos);

    // セグメント内の 1-2 桁整数を全部抽出（"--" や 4 桁年は除外）
    // 「数字に隣接する数字でない」境界条件で 1-2 桁の整数のみ拾う
    const nums = [...segment.matchAll(/(?<![\d-])(\d{1,2})(?![\d])/g)].map(
      (m) => Number(m[1]),
    );
    if (nums.length < 12) {
      throw new Error(
        `indicator "${ind.name}": only ${nums.length} numbers found in segment (expected >= 12)`,
      );
    }
    // 先頭 12 個を月別 (1-12) の発表日として採用。
    // セグメント終端付近には次指標 (Real Earnings / Productivity 等) の数字が
    // 混じるため、末尾 12 個ではなく先頭 12 個を取る。INDICATORS のラベル
    // 文字列には数字を含まないので、ラベル直後にあるはずの月次日付が確実に拾える。
    const days = nums.slice(0, 12);

    // 妥当性チェック: 全て 1-31 の範囲
    for (const d of days) {
      if (d < 1 || d > 31) {
        throw new Error(
          `indicator "${ind.name}": invalid day ${d} (must be 1-31)`,
        );
      }
    }

    indicators.push({
      key: ind.key,
      name: ind.name,
      agency: ind.agency,
      timeEt: ind.timeEt,
      dataDescription: "Data are for previous month",
      releases: days.map((day, idx) => ({ month: idx + 1, day })),
    });
  }

  return {
    year,
    source: "PFEI Schedule of Release Dates for Principal Federal Economic Indicators",
    sourceUrl,
    parsedAt: new Date().toISOString(),
    indicators,
  };
}
