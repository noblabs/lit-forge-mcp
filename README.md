# lit-forge MCP server

[lit-forge.com](https://lit-forge.com) の開発者向けユーティリティを Model Context Protocol（MCP）経由で AI から直接呼び出せるようにする stdio サーバーです。

Claude Desktop / Claude Code / Cursor など、MCP に対応した任意の AI クライアントで動作します。

## 提供ツール（10 種）

| ツール名 | 説明 |
|---|---|
| `format_json` | JSON 整形（pretty）/ 圧縮（minify） |
| `test_regex` | 正規表現マッチ（JavaScript 互換、フラグ指定可、名前付きグループ対応） |
| `decode_jwt` | JWT を Header / Payload / Signature に分解（exp/nbf/iat の人間可読化と有効期限判定つき） |
| `convert_base64` | Base64 エンコード/デコード（UTF-8 / URL-safe 対応） |
| `convert_url` | URL パーセントエンコード/デコード（component / URI 切替） |
| `generate_hash` | MD5 / SHA-1 / SHA-256 / SHA-384 / SHA-512（hex / base64） |
| `generate_uuid` | UUID v4 / v7 を最大 100 件まで一括生成 |
| `convert_timestamp` | Unix 時刻 ⇔ ISO 8601 日時（秒/ミリ秒切替） |
| `convert_yaml_json` | YAML ⇔ JSON 相互変換（js-yaml） |
| `describe_cron` | cron 式を人間可読化 + 次回実行時刻を計算（IANA タイムゾーン対応） |

すべて純関数（外部 API 不要・状態を持たない）で動作します。AI が出力した JSON を整形したり、JWT をデバッグしたり、UUID をテストデータとして大量生成したりするのに便利です。

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

`tools/list` のレスポンスに 10 ツールが並べば成功です。

## 使用例

Claude にこんな依頼ができます:

- 「この JWT をデコードして payload の中身を見せて」
- 「`name: foo\nlist: [1,2,3]` を JSON にして」
- 「`0 9 * * 1-5` を日本語で説明して、次の 5 回の実行時刻も Asia/Tokyo で出して」
- 「テストデータ用に UUID v7 を 20 個生成して」
- 「`(\\w+)@(\\w+)` でメールアドレスをパースしたいんだけど、`alice@example.com bob@test.jp` で試して」

## ライセンス

MIT
