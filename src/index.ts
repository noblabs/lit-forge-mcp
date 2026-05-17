#!/usr/bin/env node
// lit-forge MCP server エントリポイント。stdio で起動し、資産形成 + 市況 + 経済指標 +
// 地政学 + 米マクロ最新値 の 18 ツールを登録する。
// version は package.json から動的読み込み（次回以降の bump で自動同期）。

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "node:module";

import { tools } from "./tools/index.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const server = new McpServer({
  name: "lit-forge",
  version: pkg.version,
});

for (const tool of tools) {
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
    },
    tool.handler,
  );
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`lit-forge MCP server running on stdio (${tools.length} tools)`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
