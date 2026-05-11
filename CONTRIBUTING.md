# Contributing

## 経済イベントカレンダーの更新ルール

`src/lib/economic-events.ts` の `ECONOMIC_EVENTS` は **半年に 1 回手動更新** する設計です。`scripts/check-events-freshness.mjs` が 90 日前から CI 警告を出します。

### 半年に 1 回の追加 PR で必ずやること

新しい半年分のイベントを追加する PR では、**全エントリの日付を以下の公式スケジュールと突き合わせ** してください。データを Web 検索や民間カレンダーから写しただけでは、誤記（土日エントリ・祝日繰上げ無視・種別取り違えなど）が混入する事故が過去に発生しています。

#### 手順 0: 中銀（BOJ / Fed / ECB）公式日程 JSON を先に更新

中銀イベントは「議事要旨」「主な意見」など種別取り違えが起こりやすいため、`data/central-bank-schedules/{boj,fomc,ecb}.json` を一次ソースとして公式から手転記してください。各 JSON の `lastSyncedAt` を当日に更新。`ECONOMIC_EVENTS` 側の中銀エントリは JSON の `label` と完全一致させること（vitest と `npm run verify:cb` が突合）。

| 国・指標 | 公式スケジュールの確認先 |
|---|---|
| 米雇用統計（NFP） | [BLS Schedule of Releases](https://www.bls.gov/schedule/news_release/empsit.htm) |
| 米 CPI / PPI / Retail Sales | [BLS / Census Bureau Release Schedule](https://www.bls.gov/schedule/news_release/cpi.htm) |
| 米 PCE / GDP | [BEA News Release Schedule](https://www.bea.gov/news/schedule) |
| 米 ISM 製造業 / 非製造業 PMI | [ISM Calendar](https://www.ismworld.org/supply-management-news-and-reports/news-publications/) |
| FOMC（FRB） | [Federal Reserve Meeting Calendar](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm) |
| ECB 理事会 | [ECB Governing Council monetary policy meeting calendar](https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html) |
| 日銀 金融政策決定会合・主な意見・議事要旨・短観 | [日本銀行 公表予定](https://www.boj.or.jp/about/calendar/index.htm) ／ [2026 年日程 PDF](https://www.boj.or.jp/mopo/mpmsche_minu/m_ref/mref250731a.pdf) |
| 日 GDP / CPI | [内閣府 / 総務省 公表予定](https://www.cao.go.jp/) |
| 中国 NBS PMI / GDP | [中国国家統計局 发布日程](https://www.stats.gov.cn/) |
| 中国 Caixin PMI | [Caixin Insight Group](https://www.caixinglobal.com/) |
| ジャクソンホール会議 | [Federal Reserve Bank of Kansas City](https://www.kansascityfed.org/) |

### チェックリスト（PR テンプレートとして使用）

```
- [ ] data/central-bank-schedules/{boj,fomc,ecb}.json を公式から先に更新し lastSyncedAt を当日に
- [ ] 全エントリの date が yyyy-mm-dd で正しい曜日になっている（土日エントリは祝日除き禁止）
- [ ] 米雇用統計は金曜（祝日繰上げ時は木曜）に登録した
- [ ] 米 PCE は金曜に登録した
- [ ] FOMC 結果発表は水曜（米時間水曜午後 = JST 木曜深夜）に登録した
- [ ] 日銀政策決定会合・主な意見・議事要旨の公表日を日銀公式の公表予定と照合した
- [ ] 日銀「議事要旨」と「主な意見」の種別取り違えがないか確認した（公表周期: 主な意見は会合の約 2 週間後、議事要旨は次々回会合の約 3 営業日後）
- [ ] 中国 NBS PMI（製造業・非製造業）は対象月の月末日に登録した
- [ ] 米独立記念日 7/4 が土日になる年は、振替休場 + 雇用統計の前倒し発表を反映した
- [ ] vitest で `economic-events.test.ts` が全 pass する（`npx vitest run`）
- [ ] `npm run build && npm run verify:cb` が exit 0
- [ ] LAST_UPDATED を当日付に更新した
```

### 自動チェックされている項目

`src/lib/__tests__/economic-events.test.ts` で以下を検証しています:

- 土日エントリ禁止（市場休場の祝日エントリのみ例外）
- 米雇用統計は金曜・木曜（独立記念日繰上げ）のみ
- 米 PCE は金曜のみ
- FOMC 結果発表は水曜のみ
- date 形式・importance 範囲
- **中銀イベント（日銀 / FOMC / FRB 議長 / ECB）は `data/central-bank-schedules/*.json` の公式日程と完全一致**

加えて `npm run verify:cb`（`scripts/verify-central-bank-events.mjs`）で同じ TS ⊆ JSON の突合を CLI から実行できます。`name` と JSON 側 `label` は完全一致が必要なため、TS エントリを追加・修正したら JSON 側も同時に更新してください。

データ追加時はこれらに加え、**人間の目で公式スケジュールと突き合わせる**ことが必須です（テストはルール違反を検出するだけで、内容の正確性までは保証しません）。

### 過去の事故事例（再発防止）

| 日付 | 事象 | 原因 | 対策 |
|---|---|---|---|
| 2026-05-08 | 米雇用統計（4 月分）を 5/2 (土) に登録 | 公式スケジュール未確認、曜日チェック未実施 | 本ルール + vitest 整備 |
| 2026-05-08 | 米雇用統計（6 月分）を 7/4 (土) に登録 | 独立記念日繰上げの慣例を「note」だけで処理し日付を変えなかった | チェックリストの「振替」項目追加 |
| 2026-05-08 | 中国 PMI 7 月分を 8/1 (土) に登録 | 月末発表慣例を月初翌日として誤記 | 月末日ルールをチェックリスト化 |
| 2026-05-08 | 米 PCE 8 月分を 9/26 (土) に登録 | 公式スケジュール未確認 | PCE 金曜固定ルールを vitest 化 |
| 2026-05-08 | 日銀議事要旨を 5/9 (土) に登録 | 議事要旨公表日（次回会合 + 3 営業日後）の確認漏れ | 日銀公表予定との照合をチェックリスト化 |
| 2026-05-11 | 日銀「議事要旨」を 5/11 (月) に登録 → 実際は 5/12 (火) の「主な意見」（4 月会合分） | 種別取り違え（議事要旨/主な意見）＋ 日付ズレ。前回事故 (5/9 土) の再発で、平日に置いたため土日チェックが素通り | `data/central-bank-schedules/*.json` を一次ソース化 + `verify-central-bank-events.mjs` で TS ⊆ JSON を検証（vitest 統合） |

## ビルド・テスト

```bash
npm install
npm run build       # tsc
npx vitest run      # 全テスト実行
npm run verify:cb   # 中銀イベントを公式日程 JSON と突合（要 build 先行）
```

## リリース

```bash
npm version patch  # patch リリース
npm publish
```
