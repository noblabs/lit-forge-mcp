// JSON 整形・圧縮・バリデーション。

import { z } from "zod";
import { errorReply, jsonReply, type LitForgeTool } from "./types.js";

const inputSchema = {
  text: z.string().describe("整形または圧縮する JSON 文字列"),
  mode: z
    .enum(["pretty", "minify"])
    .default("pretty")
    .describe("pretty: インデントあり / minify: 1 行に圧縮"),
  indent: z
    .number()
    .int()
    .min(0)
    .max(8)
    .default(2)
    .describe("pretty 時のインデント幅（0〜8）"),
};

export const formatJson: LitForgeTool = {
  name: "format_json",
  title: "JSON 整形 / 圧縮",
  description:
    "JSON 文字列を整形（pretty）または 1 行に圧縮（minify）します。構文エラーがあれば箇所と内容を返します。",
  inputSchema,
  handler: ({ text, mode, indent }) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return errorReply(
        `JSON 構文エラー: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    const result =
      mode === "minify"
        ? JSON.stringify(parsed)
        : JSON.stringify(parsed, null, indent);
    return jsonReply({ result, byteLength: Buffer.byteLength(result, "utf8") });
  },
};
