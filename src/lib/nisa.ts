// つみたて NISA・iDeCo シミュレーション + 個人資産形成プランナー。
// 月次複利の積立年金 (annuity-immediate) をベースに、現在貯蓄の一括運用と
// 月次積立を合算した将来評価額・3 シナリオ比較・老後資金差額・必要月額逆算を扱う。

// ------------------------------
// 基本シミュ（既存 API、後方互換維持）
// ------------------------------

export type NisaYearlyEntry = {
  year: number;        // 経過年数（1, 2, ..., years）
  contribution: number; // 累計積立額（円）
  value: number;        // 評価額（円、運用益込み）
};

export type NisaResult = {
  totalContribution: number; // 元本（積立額の合計）
  finalValue: number;        // 最終評価額
  profit: number;            // 運用益（finalValue - totalContribution）
  yearly: ReadonlyArray<NisaYearlyEntry>;
};

// 月次複利での積立年金 (annuity-immediate) 評価額。
// monthlyRate=0 の場合はゼロ除算回避で単純積み上げ。
function annuityFutureValue(
  monthly: number,
  monthlyRate: number,
  months: number,
): number {
  if (months <= 0) return 0;
  if (monthlyRate === 0) return monthly * months;
  return (monthly * (Math.pow(1 + monthlyRate, months) - 1)) / monthlyRate;
}

// 一括金の月次複利将来価値。
function lumpFutureValue(
  lump: number,
  monthlyRate: number,
  months: number,
): number {
  if (months <= 0) return lump;
  if (monthlyRate === 0) return lump;
  return lump * Math.pow(1 + monthlyRate, months);
}

// 一括 + 月次積立を合算した月次複利将来価値。
export function combinedFutureValue(
  lump: number,
  monthly: number,
  monthlyRate: number,
  months: number,
): number {
  return lumpFutureValue(lump, monthlyRate, months) +
    annuityFutureValue(monthly, monthlyRate, months);
}

export function simulateNisa(params: {
  monthly: number;     // 毎月の積立額（円）
  annualRate: number;  // 想定年利（%表記。例: 5 = 5%/年）
  years: number;       // 積立年数
}): NisaResult | null {
  const { monthly, annualRate, years } = params;

  if (
    !Number.isFinite(monthly) ||
    !Number.isFinite(annualRate) ||
    !Number.isFinite(years)
  ) {
    return null;
  }
  if (monthly < 0 || annualRate < 0 || years < 0) return null;

  const monthlyRate = annualRate / 100 / 12;
  const yearly: NisaYearlyEntry[] = [];

  for (let y = 1; y <= years; y++) {
    const months = y * 12;
    yearly.push({
      year: y,
      contribution: Math.round(monthly * months),
      value: Math.round(annuityFutureValue(monthly, monthlyRate, months)),
    });
  }

  const totalContribution = Math.round(monthly * years * 12);
  const finalValue = Math.round(
    annuityFutureValue(monthly, monthlyRate, years * 12),
  );

  return {
    totalContribution,
    finalValue,
    profit: finalValue - totalContribution,
    yearly,
  };
}

// ------------------------------
// 個人資産形成プランナー
// ------------------------------

export type RiskTolerance = "conservative" | "balanced" | "aggressive";

// リスク許容度ごとの想定年利。[悲観, 現実, 楽観] の 3 シナリオ。
// 過去の長期インデックス投資実績（S&P500 / 全世界株式インデックス）を踏まえた保守的な設定値。
// 投資判断には使えない参考値。
export const SCENARIO_RATES: Record<RiskTolerance, [number, number, number]> = {
  conservative: [1, 3, 5],
  balanced: [2, 4, 6],
  aggressive: [3, 5, 8],
};

export type PlannerProfile = {
  age: number;                    // 現在の年齢
  currentSavings: number;         // 現在の投資資産（円。預金 + 投資商品の合計）
  monthlyContribution: number;    // 毎月の積立額（円）
  retirementAge: number;          // 退職（積立終了）予定年齢
  monthlyRetirementSpend: number; // 退職後の月間希望生活費（円）
  riskTolerance: RiskTolerance;
  pensionMonthly: number;         // 受給予定の公的年金月額（円。標準は厚生年金 145,000 程度）
  lifeExpectancy: number;         // 想定寿命（年。デフォルトは 85）
};

export type ScenarioLabel = "悲観" | "現実" | "楽観";

export type ScenarioResult = {
  label: ScenarioLabel;
  annualRate: number;             // この シナリオの年利（%）
  totalContribution: number;      // 月次積立の累計
  finalValue: number;             // 退職時の評価額（一括運用 + 月次積立 合算）
  profit: number;                 // 運用益（finalValue - totalContribution - currentSavings）
  yearly: ReadonlyArray<NisaYearlyEntry>; // 年次推移（合算評価額）
};

export type RetirementGap = {
  yearsAfterRetirement: number; // 想定 寿命 - retirementAge
  totalNeeded: number;          // 退職後生活費合計
  pensionTotal: number;         // 公的年金合計
  netNeeded: number;            // 不足額 = totalNeeded - pensionTotal
  // 各シナリオで老後資金不足をカバーできるか（finalValue >= netNeeded）
  worstCovers: boolean;
  realCovers: boolean;
  bestCovers: boolean;
};

export type PlannerResult = {
  profile: PlannerProfile;
  years: number;                          // = retirementAge - age
  scenarios: [ScenarioResult, ScenarioResult, ScenarioResult]; // 悲観/現実/楽観
  retirementGap: RetirementGap;
  // 現実シナリオで netNeeded を達成するために必要な月額。達成不可なら null。
  requiredMonthlyForRealScenario: number | null;
};

function buildScenario(
  label: ScenarioLabel,
  annualRate: number,
  profile: PlannerProfile,
  years: number,
): ScenarioResult {
  const monthlyRate = annualRate / 100 / 12;
  const months = years * 12;
  const yearly: NisaYearlyEntry[] = [];

  for (let y = 1; y <= years; y++) {
    const m = y * 12;
    yearly.push({
      year: y,
      contribution: Math.round(profile.monthlyContribution * m),
      value: Math.round(
        combinedFutureValue(
          profile.currentSavings,
          profile.monthlyContribution,
          monthlyRate,
          m,
        ),
      ),
    });
  }

  const totalContribution = Math.round(profile.monthlyContribution * months);
  const finalValue = Math.round(
    combinedFutureValue(
      profile.currentSavings,
      profile.monthlyContribution,
      monthlyRate,
      months,
    ),
  );

  return {
    label,
    annualRate,
    totalContribution,
    finalValue,
    profit: finalValue - totalContribution - profile.currentSavings,
    yearly,
  };
}

// 必要な月額を逆算（一括運用込み）。
// finalValue = lumpFV + monthly * annuityFactor
// monthly = (target - lumpFV) / annuityFactor
// target に届かなければ null（年利が低すぎ or 期間が短すぎ）。
function solveMonthlyForTarget(
  target: number,
  currentSavings: number,
  annualRate: number,
  years: number,
): number | null {
  if (years <= 0) return null;
  const monthlyRate = annualRate / 100 / 12;
  const months = years * 12;
  const lumpFV = lumpFutureValue(currentSavings, monthlyRate, months);
  if (lumpFV >= target) return 0;
  const remaining = target - lumpFV;
  const annuityFactor = monthlyRate === 0
    ? months
    : (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
  if (annuityFactor <= 0) return null;
  return Math.ceil(remaining / annuityFactor);
}

export function planRetirement(
  profile: PlannerProfile,
): PlannerResult | null {
  const fields: ReadonlyArray<number> = [
    profile.age,
    profile.currentSavings,
    profile.monthlyContribution,
    profile.retirementAge,
    profile.monthlyRetirementSpend,
    profile.pensionMonthly,
    profile.lifeExpectancy,
  ];
  if (fields.some((v) => !Number.isFinite(v) || v < 0)) return null;
  if (profile.retirementAge <= profile.age) return null;
  if (profile.lifeExpectancy <= profile.retirementAge) return null;
  if (!SCENARIO_RATES[profile.riskTolerance]) return null;

  const years = profile.retirementAge - profile.age;
  const [worstRate, realRate, bestRate] = SCENARIO_RATES[profile.riskTolerance];

  const scenarios: [ScenarioResult, ScenarioResult, ScenarioResult] = [
    buildScenario("悲観", worstRate, profile, years),
    buildScenario("現実", realRate, profile, years),
    buildScenario("楽観", bestRate, profile, years),
  ];

  const yearsAfterRetirement = profile.lifeExpectancy - profile.retirementAge;
  const monthsAfter = yearsAfterRetirement * 12;
  const totalNeeded = profile.monthlyRetirementSpend * monthsAfter;
  const pensionTotal = profile.pensionMonthly * monthsAfter;
  const netNeeded = Math.max(0, totalNeeded - pensionTotal);

  const requiredMonthlyForRealScenario = solveMonthlyForTarget(
    netNeeded,
    profile.currentSavings,
    realRate,
    years,
  );

  return {
    profile,
    years,
    scenarios,
    retirementGap: {
      yearsAfterRetirement,
      totalNeeded: Math.round(totalNeeded),
      pensionTotal: Math.round(pensionTotal),
      netNeeded: Math.round(netNeeded),
      worstCovers: scenarios[0].finalValue >= netNeeded,
      realCovers: scenarios[1].finalValue >= netNeeded,
      bestCovers: scenarios[2].finalValue >= netNeeded,
    },
    requiredMonthlyForRealScenario,
  };
}

// プランナーのデフォルトプロファイル（UI 初期値）。
export const DEFAULT_PROFILE: PlannerProfile = {
  age: 35,
  currentSavings: 1_000_000,
  monthlyContribution: 30_000,
  retirementAge: 65,
  monthlyRetirementSpend: 250_000,
  riskTolerance: "balanced",
  pensionMonthly: 145_000,
  lifeExpectancy: 85,
};
