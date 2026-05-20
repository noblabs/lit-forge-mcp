// S&P Global 米 PMI 速報（flash）の発表日程データ（v0.15.0 新設）。
//
// 背景:
//   - S&P Global（旧 Markit）は民間データ会社で、官公庁カレンダー実取得の対象外。
//     pulse の網羅性の穴になっていた（新規失業保険申請件数とともに 2026-05-21 取りこぼし）。
//   - 民間サイトのスクレイピングは ToS リスクがあるため、PFEI と同思想で
//     公式リリースカレンダーから手転記した静的データを返す（HTTP なし・常時成功）。
//   - 米 flash PMI は製造業・サービス業を同日 09:45 ET に公表する。
//
// 運用:
//   - 一次ソース: S&P Global PMI 公式リリースカレンダー（https://www.pmi.spglobal.com/）。
//   - 半年に 1 回、公式カレンダーから flashReleases を更新し lastSyncedAt を当日に。
//   - confirmed=false は「公式カレンダー未確認の暫定値」。確認できた日付のみ confirmed=true にする。
//     ⚠️ 現時点では 2026-05 のみ確認済み。それ以降は要追記（捏造しないため空のまま）。

export type SpGlobalPmiFlashRelease = {
  year: number;
  month: number; // 1-12
  day: number; // ET カレンダー上の flash 発表日
  confirmed: boolean; // S&P Global 公式カレンダーで裏取り済みか
};

export type SpGlobalPmiSchedule = {
  source: string;
  sourceUrl: string;
  lastSyncedAt: string; // YYYY-MM-DD
  scopeStart: string; // YYYY-MM-DD
  scopeEnd: string; // YYYY-MM-DD
  releaseTimeEt: string; // "09:45"（製造業・サービス業とも同時刻）
  comment: string;
  flashReleases: readonly SpGlobalPmiFlashRelease[];
};

export const SP_GLOBAL_PMI_SCHEDULE: SpGlobalPmiSchedule = {
  source: "S&P Global PMI",
  sourceUrl: "https://www.pmi.spglobal.com/",
  lastSyncedAt: "2026-05-21",
  scopeStart: "2026-05-01",
  scopeEnd: "2026-12-31",
  releaseTimeEt: "09:45",
  comment:
    "米 flash PMI（製造業・サービス業）の発表日。S&P Global 公式リリースカレンダーから手転記。" +
    "09:45 ET 公表（DST 期間は 22:45 JST / 標準時は 23:45 JST、同日内）。" +
    "confirmed=true のみが公式裏取り済み。2026-06 以降は未確認のため未収録（要追記）。",
  flashReleases: [
    // 2026-05 分のみ確認済み（発表日: 5/21 木）。
    { year: 2026, month: 5, day: 21, confirmed: true },
  ],
};
