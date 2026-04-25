// 文字列のハッシュを生成。SHA-1/256/384/512 と MD5 をサポート。

import { createHash } from "node:crypto";
import { z } from "zod";
import { jsonReply, type LitForgeTool } from "./types.js";

const ALGORITHMS = ["md5", "sha1", "sha256", "sha384", "sha512"] as const;

const inputSchema = {
  text: z.string().describe("ハッシュ化するテキスト（UTF-8）"),
  algorithm: z
    .enum(ALGORITHMS)
    .default("sha256")
    .describe("ハッシュアルゴリズム（既定 sha256）"),
  encoding: z
    .enum(["hex", "base64"])
    .default("hex")
    .describe("出力エンコーディング（hex / base64）"),
};

export const generateHash: LitForgeTool = {
  name: "generate_hash",
  title: "ハッシュ生成",
  description:
    "テキストのハッシュ値を生成します（MD5 / SHA-1 / SHA-256 / SHA-384 / SHA-512）。MD5 と SHA-1 は互換性目的で残しており、新規用途は SHA-256 以上を推奨します。",
  inputSchema,
  handler: ({ text, algorithm, encoding }) => {
    const result = createHash(algorithm)
      .update(text, "utf8")
      .digest(encoding);
    return jsonReply({ algorithm, encoding, result });
  },
};
