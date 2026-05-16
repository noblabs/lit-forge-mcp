# lit-forge MCP server

[![npm version](https://img.shields.io/npm/v/lit-forge-mcp.svg)](https://www.npmjs.com/package/lit-forge-mcp)
[![license](https://img.shields.io/npm/l/lit-forge-mcp.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/lit-forge-mcp.svg)](https://nodejs.org)

**個人資産形成プランナー（つみたて NISA・iDeCo）と主要マクロ指標の取得**を Model Context Protocol（MCP）経由で AI から直接呼び出せるようにする stdio サーバーです。

Claude Desktop / Claude Code / Cursor など、MCP に対応した任意の AI クライアントで動作します。

> **v0.2.0 で「金融・個人投資家特化」にピボット**、**v0.3.0 で「毎朝の市況チェック」系 3 ツールを追加**、**v0.4.0 で銘柄数 9 → 28 に拡大 + 5 つの分析ツール追加**、**v0.6.0 で配当履歴・アナリストコンセンサス・ファンダメンタル指標を追加**、**v0.7.0 で経済イベントに地政学カテゴリ（要人訪問・首脳会談）と複数日イベント（endDate）対応を追加**、**v0.8.0 で地政学イベント専用ツール `get_geopolitical_events` を新設**（首脳会談・国際サミット・主要国選挙・地政学リスクの 4 サブカテゴリを market implications 付きで返す + 一次ソース突合の verify インフラ整備）、**v0.9.0 で地政学ツールを 2 系統に分離・リアルタイム化**: 旧 `get_geopolitical_events` を `get_geopolitical_calendar` にリネーム（用途を確定スケジュール専用に明確化）、新ツール `get_geopolitical_pulse` を追加（BBC World / Al Jazeera / Google News の主要通信社 RSS を集約し、進行中の地政学リスク・突発イベントをリアルタイムで返す）しました。

## 提供ツール（17 種）

### 個人資産形成プランナー（純関数、外部 API 不要）

| ツール名 | 説明 |
|---|---|
| `simulate_nisa` | 月の積立額・想定年利・年数から、月次複利で評価額・運用益・年次推移を試算 |
| `plan_retirement` | 年齢・貯蓄・収入・希望生活費・リスク許容度・年金から、楽観/現実/悲観 3 シナリオで老後資金の充足度を診断 + 必要月額逆算 |
| `calculate_required_monthly` | 目標金額・現在の貯蓄・年利・年数から、達成に必要な毎月の積立額を逆算 |
| `calculate_compound_interest` | 元本（一括）と月次積立を月次複利で評価する汎用複利計算ツール |

### 市況・経済イベント（**HTTP 通信あり**）

| ツール名 | 説明 |
|---|---|
| `get_market_snapshot` | USD/JPY・EUR/JPY・GBP/JPY・AUD/JPY・EUR/USD・CHF/JPY・ドル指数・日経平均・TOPIX・NY ダウ・S&P 500・NASDAQ・VIX・NYSE FANG+・SOX・DAX・FTSE・上海総合・ハンセン・KOSPI・SENSEX・米10年/5年金利・金・原油・銅・ビットコイン・イーサリアム の主要 28 指標を一括取得 |
| `get_economic_events_today` | 当日 or 今週の経済イベント（FOMC・日銀金融政策決定会合・米雇用統計・CPI・GDP・中国 PMI 等のマクロ指標）を重要度付きで返す。`category` で `macro` / `policy` に絞り込み可能。期間イベント（ジャクソンホール会議等）は `endDate` で複数日対応。半年分を手動キュレーション。※ v0.9.0 で地政学イベントは `get_geopolitical_calendar` / `get_geopolitical_pulse` に分離 |
| `get_geopolitical_calendar` | **v0.9.0 で `get_geopolitical_events` からリネーム**。**確定済み公式スケジュール専用**: 本日・今週・今月の地政学イベントを 4 サブカテゴリ（summit / bilateral / election / risk）で返す。`marketImplications` / `participants` / `sourceUrl` 付き。半年に 1 回 PR で手動更新の静的データ。進行中の地政学リスクは `get_geopolitical_pulse` を使用 |
| `get_geopolitical_pulse` | **v0.9.0 新規**。**リアルタイム速報**: BBC World・Al Jazeera・Google News（トピック検索）の RSS を並列取得し、進行中の地政学イベント（首脳会談・紛争・制裁・封鎖シナリオ等）を最新順で返す。`topic`: us-china / middle-east / ukraine / japan / global。記事メタデータ（タイトル・配信元・配信日時・URL）のみで、解釈は呼び出し側 LLM の責務 |
| `get_quote` | 任意の Yahoo Finance ティッカー（株・為替・指数・コモディティ・暗号資産）の現在値・前日比を取得。例: `AAPL` / `^DJI` / `BTC-USD`。`includeFundamentals: true` で PER / PBR / 配当利回り / ベータ / 時価総額も取得（v0.6.0） |

### 分析ツール（v0.4.0 新規）

| ツール名 | 説明 |
|---|---|
| `get_market_thermometer` | VIX・S&P 500・米10年金利・ドル指数を合成した 0-100 のリスクオン/オフ・スコア + 過去 30 営業日推移 |
| `get_performance_ranking` | 28 銘柄を `1d`/`1w`/`1m` のパフォーマンスでソート、上位/下位 N 件を返す |
| `get_yield_spread` | 米10年-5年イールドスプレッド（プラス=順イールド / マイナス=逆イールド） |
| `get_market_sessions` | 主要 4 市場（東京・上海・ロンドン・NY）の現在の取引時間ステータス（open / pre-open / closed / **holiday**、v0.5.0 で祝日対応） |
| `get_sector_heatmap` | 米株セクター ETF（SPDR、11 セクター）の前日比一覧 |

### 個別株の深掘りツール（v0.6.0 新規）

| ツール名 | 説明 |
|---|---|
| `get_dividend_history` | 個別株・ETF の過去 N 年の配当履歴と暦年合計を取得（`years`: 1/3/5/10、既定 5）。NISA 成長投資枠で配当銘柄を検討する一次情報として使用 |
| `get_analyst_consensus` | 個別株のアナリスト推奨レーティング（強気買い〜強気売り）・目標株価（平均/高値/安値）・月別推奨内訳を取得。米国株は coverage が厚く、TSE 銘柄や ETF は欠損しやすい |

### 米マクロ最新値（v0.13.0 新規）

| ツール名 | 説明 |
|---|---|
| `get_us_macro_latest` | **米マクロ三大指標**（雇用統計・CPI・PPI）+ コア CPI・コア PPI（食料・エネルギー除く）+ 失業率 + 平均時給の最新発表値と前月比・前年同月比を BLS Public Data API v2 から取得（API key 不要・無認証、7 系列を 1 リクエスト）。`get_economic_release_pulse` が答える「次にいつ発表されるか」に対し、本ツールは「今の数字はいくつか」を答える |

> ⚠ **HTTP 通信について**: 市況・分析・個別株系ツールは **Yahoo Finance API（query1.finance.yahoo.com / query2.finance.yahoo.com）** へ HTTPS リクエストを送信します。実行 PC のネットワークから外部に出る通信が発生する点にご留意ください。データは約 1 時間遅れの参考値で、**投資助言ではなく情報集約**として提供しています。
>
> v0.6.0 で `get_quote includeFundamentals=true` / `get_dividend_history` / `get_analyst_consensus` の 3 ルートが Yahoo Finance v10 quoteSummary（crumb 認証あり）を経由するため、`yahoo-finance2` パッケージを依存に追加しました。

Claude / GPT / Cursor との対話の中で「老後資金大丈夫？」「月いくら積み立てれば？」「今日の市況を要約して」「FOMC は今週いつ？」「マーケット温度計は？」「セクターでどこが強い？」「今月の G7 サミットは？」「次の米中首脳会談はいつ？」「**今のイラン情勢は？**」「**ウクライナ和平の最新ニュースは？**」を即座に試算・確認できます。

## インストール / 設定

### Claude Desktop の場合

`claude_desktop_config.json` に以下を追加します。

```json
{
  "mcpServers": {
    "lit-forge": {
      "command": "npx",
      "args": ["-y", "lit-forge-mcp@latest"]
    }
  }
}
```

設定ファイルの場所:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

### Claude Code の場合

```bash
claude mcp add lit-forge -- npx -y lit-forge-mcp@latest
```

### Cursor の場合

`~/.cursor/mcp.json`（または プロジェクト直下の `.cursor/mcp.json`）に同じ JSON を追加します。

### 💡 `@latest` 指定について

上記の設定例ではいずれも `lit-forge-mcp@latest` を指定しています。これは `npx` のキャッシュ挙動により、バージョン指定なしの場合に古いキャッシュ版が使われ続けることがあるためです。`@latest` を指定すると、起動時に npm registry の最新タグを毎回確認して取得します（バージョン解決のオーバーヘッドはわずか）。

すでに `lit-forge-mcp`（バージョン指定なし）で運用中の方は、新機能・バグ修正を取り込むために以下のいずれかをお試しください:

1. **設定を `lit-forge-mcp@latest` に変更**（恒久対応、推奨）
2. **npx キャッシュをクリア**: `npx clear-npx-cache` または手動で `~/.npm/_npx/` を削除
3. **MCP クライアント（Claude Desktop など）を完全終了して再起動**

## ローカル開発

```bash
git clone https://github.com/noblabs/lit-forge-mcp.git
cd lit-forge-mcp
npm install
npm run build
node dist/index.js   # stdio で起動
```

### 動作確認

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0.0.1"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | node dist/index.js
```

`tools/list` のレスポンスに 17 ツールが並べば成功です。

## 使用例

Claude にこんな依頼ができます:

**資産形成プランニング**
- 「私は35歳で月3万を積立中。現在の貯蓄500万、退職65歳、月の希望生活費25万。老後資金足りる？」
- 「20年で2000万作りたい。今500万あって年利4%なら毎月いくら積み立てればいい？」
- 「100万円を年利5%で30年複利運用したらいくらになる？」
- 「月3万円を年利6%で20年積み立てたら？」

**市況・経済イベント（v0.3.0）**
- 「今日の市況を要約して」「主要指標の前日比を表で見せて」
- 「今週の経済イベントは？特に FOMC や日銀の予定を教えて」
- 「米10年金利と日経平均の動きから、今のリスクオン度合いをコメントして」
- 「BTC-USD の今の値は？」「ポンド円（GBPJPY=X）を教えて」

**個別株の深掘り（v0.6.0）**
- 「KO の過去 10 年の配当推移を見せて」「VYM の年次配当合計は？」
- 「NVDA のアナリスト目標株価と推奨レーティングは？」
- 「AAPL の PER / PBR / 配当利回り / ベータをまとめて」（`get_quote` で `includeFundamentals=true`）

**地政学イベント（v0.8.0）**
- 「今週の地政学イベントは？」「今月の G7 サミットの予定は？」
- 「次の米中首脳会談はいつ？」「ベッセント訪日の詳細を教えて」
- 「今月の主要国選挙をまとめて」「日本に関係する首脳会談だけ抽出して」（`country=["JP"]` で絞り込み）

## 投資判断の免責

本ツールの試算はすべて月次複利による参考値です。実際の運用結果（市場変動・税金・手数料・為替）を保証するものではありません。個別の金融商品の推奨ではなく、**投資判断はご自身の責任**でお願いします。

公的年金額の概算は厚生年金の標準値ベースです。正確な見込み額は[ねんきんネット](https://www.nenkin.go.jp/n_net/)でご確認ください。

## ライセンス

MIT
