// UUID v4 / v7 を最大 100 件まで一括生成。

import { randomUUID, randomBytes } from "node:crypto";
import { z } from "zod";
import { jsonReply, type LitForgeTool } from "./types.js";

const inputSchema = {
  version: z
    .enum(["v4", "v7"])
    .default("v4")
    .describe("v4: 完全ランダム / v7: 先頭48bitが Unix ミリ秒で時刻順"),
  count: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(1)
    .describe("生成件数（1〜100）"),
};

// v7: RFC 9562 準拠。先頭48ビットが Unix ミリ秒。
function generateV7(): string {
  const unixMs = Date.now();
  const tsHex = unixMs.toString(16).padStart(12, "0");
  const rand = randomBytes(10);
  // 上位4ビットをバージョン(0x7)に
  rand[0] = (rand[0] & 0x0f) | 0x70;
  // バリアントビットを RFC 4122 (10xx) に
  rand[2] = (rand[2] & 0x3f) | 0x80;
  const hex = rand.toString("hex");
  return `${tsHex.slice(0, 8)}-${tsHex.slice(8, 12)}-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 20)}`;
}

export const generateUuid: LitForgeTool = {
  name: "generate_uuid",
  title: "UUID 生成",
  description:
    "UUID v4（完全ランダム）または v7（時刻順ソート可能）を最大 100 件まで一括生成します。",
  inputSchema,
  handler: ({ version, count }) => {
    const fn = version === "v4" ? () => randomUUID() : generateV7;
    const uuids = Array.from({ length: count }, fn);
    return jsonReply({ version, count, uuids });
  },
};
