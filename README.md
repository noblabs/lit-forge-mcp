# lit-forge MCP server

[![npm version](https://img.shields.io/npm/v/lit-forge-mcp.svg)](https://www.npmjs.com/package/lit-forge-mcp)
[![license](https://img.shields.io/npm/l/lit-forge-mcp.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/lit-forge-mcp.svg)](https://nodejs.org)

[lit-forge.com](https://lit-forge.com) の **個人資産形成プランナー（つみたて NISA・iDeCo）** を Model Context Protocol（MCP）経由で AI から直接呼び出せるようにする stdio サーバーです。

Claude Desktop / Claude Code / Cursor など、MCP に対応した任意の AI クライアントで動作します。

> **v0.2.0 で「金融・個人投資家特化」にピボット**しました。旧 dev ユーティリティ 10 ツール（JSON / regex / JWT / Base64 等）は廃止し、NISA / iDeCo / 退職資金プランニング系の 4 ツールに刷新しています。

## 提供ツール（4 種）

| ツール名 | 説明 |
|---|---|
| `simulate_nisa` | 月の積立額・想定年利・年数から、月次複利で評価額・運用益・年次推移を試算 |
| `plan_retirement` | 年齢・貯蓄・収入・希望生活費・リスク許容度・年金から、楽観/現実/悲観 3 シナリオで老後資金の充足度を診断 + 必要月額逆算 |
| `calculate_required_monthly` | 目標金額・現在の貯蓄・年利・年数から、達成に必要な毎月の積立額を逆算 |
| `calculate_compound_interest` | 元本（一括）と月次積立を月次複利で評価する汎用複利計算ツール |

すべて純関数（外部 API 不要・状態を持たない）。Claude / GPT / Cursor との対話の中で「老後資金大丈夫？」「月いくら積み立てれば？」を即座に試算できます。

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

`tools/list` のレスポンスに 4 ツールが並べば成功です。

## 使用例

Claude にこんな依頼ができます:

- 「私は35歳で月3万を積立中。現在の貯蓄500万、退職65歳、月の希望生活費25万。老後資金足りる？」
- 「20年で2000万作りたい。今500万あって年利4%なら毎月いくら積み立てればいい？」
- 「100万円を年利5%で30年複利運用したらいくらになる？」
- 「月3万円を年利6%で20年積み立てたら？」

## 投資判断の免責

本ツールの試算はすべて月次複利による参考値です。実際の運用結果（市場変動・税金・手数料・為替）を保証するものではありません。個別の金融商品の推奨ではなく、**投資判断はご自身の責任**でお願いします。

公的年金額の概算は厚生年金の標準値ベースです。正確な見込み額は[ねんきんネット](https://www.nenkin.go.jp/n_net/)でご確認ください。

## ライセンス

MIT
