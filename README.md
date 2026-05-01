# lit-forge MCP server

[![npm version](https://img.shields.io/npm/v/lit-forge-mcp.svg)](https://www.npmjs.com/package/lit-forge-mcp)
[![license](https://img.shields.io/npm/l/lit-forge-mcp.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/lit-forge-mcp.svg)](https://nodejs.org)

[lit-forge.com](https://lit-forge.com) の **個人資産形成プランナー（つみたて NISA・iDeCo）** を Model Context Protocol（MCP）経由で AI から直接呼び出せるようにする stdio サーバーです。

Claude Desktop / Claude Code / Cursor など、MCP に対応した任意の AI クライアントで動作します。

> **v0.2.0 で「金融・個人投資家特化」にピボット**、**v0.3.0 で「毎朝の市況チェック」系 3 ツールを追加**、**v0.4.0 で銘柄数 9 → 28 に拡大 + 5 つの分析ツール追加**しました。

## 提供ツール（12 種）

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
| `get_market_snapshot` | USD/JPY・EUR/JPY・GBP/JPY・AUD/JPY・EUR/USD・CHF/JPY・ドル指数・日経平均・TOPIX・NY ダウ・S&P 500・NASDAQ・VIX・NYSE FANG+・SOX・DAX・FTSE・上海総合・ハンセン・KOSPI・SENSEX・米10年/5年金利・金・原油・銅・ビットコイン・イーサリアム の主要 28 指標を一括取得（[lit-forge.com/today](https://lit-forge.com/today) と同等） |
| `get_economic_events_today` | 当日 or 今週の経済イベント（FOMC・日銀金融政策決定会合・米雇用統計・CPI・GDP・中国 PMI 等）を重要度付きで返す。半年分を手動キュレーション |
| `get_quote` | 任意の Yahoo Finance ティッカー（株・為替・指数・コモディティ・暗号資産）の現在値・前日比を取得。例: `AAPL` / `^DJI` / `BTC-USD` |

### 分析ツール（v0.4.0 新規）

| ツール名 | 説明 |
|---|---|
| `get_market_thermometer` | VIX・S&P 500・米10年金利・ドル指数を合成した 0-100 のリスクオン/オフ・スコア + 過去 30 営業日推移 |
| `get_performance_ranking` | 28 銘柄を `1d`/`1w`/`1m` のパフォーマンスでソート、上位/下位 N 件を返す |
| `get_yield_spread` | 米10年-5年イールドスプレッド（プラス=順イールド / マイナス=逆イールド） |
| `get_market_sessions` | 主要 4 市場（東京・上海・ロンドン・NY）の現在の取引時間ステータス |
| `get_sector_heatmap` | 米株セクター ETF（SPDR、11 セクター）の前日比一覧 |

> ⚠ **HTTP 通信について**: 市況・分析系ツールは **Yahoo Finance API（query1.finance.yahoo.com）** へ HTTPS リクエストを送信します。実行 PC のネットワークから外部に出る通信が発生する点にご留意ください。データは約 1 時間遅れの参考値で、**投資助言ではなく情報集約**として提供しています。

Claude / GPT / Cursor との対話の中で「老後資金大丈夫？」「月いくら積み立てれば？」「今日の市況を要約して」「FOMC は今週いつ？」「マーケット温度計は？」「セクターでどこが強い？」を即座に試算・確認できます。

## インストール / 設定

### Claude Desktop の場合

`claude_desktop_config.json` に以下を追加します。

```json
{
  "mcpServers": {
    "lit-forge": {
      "command": "npx",
      "args": ["-y", "lit-forge-mcp"]
    }
  }
}
```

設定ファイルの場所:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

### Claude Code の場合

```bash
claude mcp add lit-forge -- npx -y lit-forge-mcp
```

### Cursor の場合

`~/.cursor/mcp.json`（または プロジェクト直下の `.cursor/mcp.json`）に同じ JSON を追加します。

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

`tools/list` のレスポンスに 7 ツールが並べば成功です。

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

## 投資判断の免責

本ツールの試算はすべて月次複利による参考値です。実際の運用結果（市場変動・税金・手数料・為替）を保証するものではありません。個別の金融商品の推奨ではなく、**投資判断はご自身の責任**でお願いします。

公的年金額の概算は厚生年金の標準値ベースです。正確な見込み額は[ねんきんネット](https://www.nenkin.go.jp/n_net/)でご確認ください。

## ライセンス

MIT
