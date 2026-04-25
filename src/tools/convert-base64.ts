// Base64 エンコード / デコード。UTF-8 と URL-safe Base64 に対応。

import { z } from "zod";
import { errorReply, jsonReply, type LitForgeTool } from "./types.js";

const inputSchema = {
  text: z.string().describe("変換対象のテキスト"),
  mode: z.enum(["encode", "decode"]).describe("encode: テキスト→Base64 / decode: Base64→テキスト"),
  urlSafe: z
    .boolean()
    .default(false)
    .describe("URL-safe Base64（+/= を -_ に置換、パディングなし）を使うか"),
};

export const convertBase64: LitForgeTool = {
  name: "convert_base64",
  title: "Base64 変換",
  description:
    "テキストと Base64 を相互変換します。UTF-8 で扱い、URL-safe Base64 にも対応します。",
  inputSchema,
  handler: ({ text, mode, urlSafe }) => {
    if (mode === "encode") {
      const b64 = Buffer.from(text, "utf8").toString("base64");
      const result = urlSafe
        ? b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
        : b64;
      return jsonReply({ result });
    }
    try {
      const normalized = urlSafe
        ? text.replace(/-/g, "+").replace(/_/g, "/")
        : text;
      const padded =
        normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
      const result = Buffer.from(padded, "base64").toString("utf8");
      return jsonReply({ result });
    } catch (e) {
      return errorReply(
        `Base64 デコードに失敗: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  },
};
