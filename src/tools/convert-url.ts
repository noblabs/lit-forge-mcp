// URL エンコード / デコード（パーセントエンコード）。

import { z } from "zod";
import { errorReply, jsonReply, type LitForgeTool } from "./types.js";

const inputSchema = {
  text: z.string().describe("変換対象のテキスト"),
  mode: z
    .enum(["encode", "decode"])
    .describe("encode: テキスト→%xx / decode: %xx→テキスト"),
  component: z
    .boolean()
    .default(true)
    .describe("true: encodeURIComponent / false: encodeURI を使う（既定 true）"),
};

export const convertUrl: LitForgeTool = {
  name: "convert_url",
  title: "URL エンコード / デコード",
  description:
    "テキストをパーセントエンコード（%xx）でエンコード/デコードします。component=true（既定）は予約文字も含めて全エスケープします。",
  inputSchema,
  handler: ({ text, mode, component }) => {
    try {
      if (mode === "encode") {
        const result = component ? encodeURIComponent(text) : encodeURI(text);
        return jsonReply({ result });
      }
      const result = component ? decodeURIComponent(text) : decodeURI(text);
      return jsonReply({ result });
    } catch (e) {
      return errorReply(
        `URL ${mode === "encode" ? "エンコード" : "デコード"}に失敗: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  },
};
