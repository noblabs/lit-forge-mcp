#!/usr/bin/env node
// lit-forge MCP server エントリポイント。stdio で起動し、NISA / iDeCo 個人資産形成
// プランナー系 4 ツールを登録する。

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { tools } from "./tools/index.js";

const server = new McpServer({
  name: "lit-forge",
  version: "0.3.0",
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
