// MCP ツールの共通型。registerTool に渡す形に揃える。
// 型は各ツール内で zod から推論し、配列に集約する際は緩く扱う。

import type { ZodRawShape } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type LitForgeTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: ZodRawShape;
  handler: (args: any) => CallToolResult | Promise<CallToolResult>;
};

// 構造化レスポンスをテキスト 1 件で返すためのヘルパー。
// MCP は content[].text を string で要求するので JSON.stringify する。
export function jsonReply(data: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function errorReply(message: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}
