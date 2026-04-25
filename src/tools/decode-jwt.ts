// JWT トークンを Header / Payload / Signature に分解してデコード。署名検証は行わない。

import { z } from "zod";
import { errorReply, jsonReply, type LitForgeTool } from "./types.js";

const inputSchema = {
  token: z.string().describe("JWT トークン全体（xxx.yyy.zzz 形式）"),
};

function base64UrlToObject(s: string): unknown {
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const json = Buffer.from(padded, "base64").toString("utf8");
  return JSON.parse(json);
}

export const decodeJwt: LitForgeTool = {
  name: "decode_jwt",
  title: "JWT デコード",
  description:
    "JWT トークンを Header / Payload / Signature に分解してデコードします（署名検証は行いません）。exp / nbf / iat の人間可読時刻と有効期限切れ判定も付与します。",
  inputSchema,
  handler: ({ token }) => {
    const parts = token.trim().split(".");
    if (parts.length !== 3) {
      return errorReply("JWT の形式が無効です（xxx.yyy.zzz の 3 パートが必要）");
    }
    let header: unknown;
    let payload: unknown;
    try {
      header = base64UrlToObject(parts[0]);
    } catch (e) {
      return errorReply(
        `Header のデコードに失敗: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    try {
      payload = base64UrlToObject(parts[1]);
    } catch (e) {
      return errorReply(
        `Payload のデコードに失敗: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    const p = payload as Record<string, unknown>;
    const now = Math.floor(Date.now() / 1000);
    const expired = typeof p.exp === "number" ? now > p.exp : false;
    const claims: Record<string, string> = {};
    for (const k of ["exp", "nbf", "iat"] as const) {
      const v = p[k];
      if (typeof v === "number") {
        claims[`${k}Iso`] = new Date(v * 1000).toISOString();
      }
    }
    return jsonReply({
      header,
      payload,
      signature: parts[2],
      expired,
      ...claims,
    });
  },
};
