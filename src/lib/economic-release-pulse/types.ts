// 経済指標リリース予定のリアルタイム取得（v0.11.0 新設）の共通型。
//
// 背景: get_economic_events_today は手動キュレーション（★★★ 中心・半年 1 回更新）で、
// NY 連銀製造業や鉱工業生産など収録外の指標を「取りこぼす」網羅性の穴があった。
// 本モジュールは公式機関のリリースカレンダーをアダプタ経由で実取得し、
// 既存ツールを「補完」する（置き換えではない）。
//
// 設計思想は geopolitical-pulse.ts を踏襲: 各ソースは独立、失敗しても全体は止めず
// AdapterResult[] で部分成功を呼び出し側に伝える。

export type ReleaseCountry = "US" | "JP" | "EU" | "GB" | "CN";

// 正規化済みの経済指標リリース予定 1 件。
export type ReleaseEvent = {
  date: string; // YYYY-MM-DD（JST）
  time?: string; // HH:MM（JST）。不明・終日扱いなら省略
  country: ReleaseCountry;
  name: string; // 例: "米 GDP" / "日 GDP速報 2026年1-3月期（1次速報）"
  source: string; // アダプタの表示ラベル。例: "BEA"
  sourceUrl: string; // 一次ソース URL
};

// 1 アダプタの実行結果メタ。エラー時も配列に含めて部分成功を伝える
// （geopolitical-pulse の FeedResult と同思想）。
export type AdapterResult = {
  key: string;
  label: string;
  ok: boolean;
  count: number;
  error?: string;
  elapsedMs: number;
};

// アダプタ本体。fetchEvents は ReleaseEvent[] を返すか throw する
// （throw は aggregator が捕捉して AdapterResult.error にする）。
export type ReleaseAdapter = {
  key: string;
  label: string;
  fetchEvents: () => Promise<ReleaseEvent[]>;
};
