// 正規表現マッチ。JavaScript の RegExp（ECMAScript 準拠）を使う。

import { z } from "zod";
import { errorReply, jsonReply, type LitForgeTool } from "./types.js";

const inputSchema = {
  pattern: z.string().describe("正規表現本体（スラッシュは付けない）"),
  flags: z
    .string()
    .regex(/^[gimsuy]*$/)
    .default("g")
    .describe("正規表現フラグ（g/i/m/s/u/y のみ）"),
  text: z.string().describe("マッチさせる対象テキスト"),
  maxMatches: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(100)
    .describe("返すマッチ件数の上限"),
};

export const testRegex: LitForgeTool = {
  name: "test_regex",
  title: "正規表現テスト",
  description:
    "JavaScript 互換の正規表現でテキストをマッチします。マッチ位置・キャプチャグループ・名前付きグループを返します。",
  inputSchema,
  handler: ({ pattern, flags, text, maxMatches }) => {
    let re: RegExp;
    try {
      // g フラグが無いと matchAll はエラーになるので強制付与
      re = new RegExp(pattern, flags.includes("g") ? flags : flags + "g");
    } catch (e) {
      return errorReply(
        `正規表現エラー: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    const matches: Array<{
      match: string;
      index: number;
      groups: string[];
      namedGroups?: Record<string, string>;
    }> = [];
    let count = 0;
    for (const m of text.matchAll(re)) {
      if (count >= maxMatches) break;
      matches.push({
        match: m[0],
        index: m.index ?? -1,
        groups: m.slice(1).map((g: string | undefined) => g ?? ""),
        ...(m.groups ? { namedGroups: m.groups } : {}),
      });
      count++;
    }
    return jsonReply({
      matchCount: matches.length,
      truncated: count >= maxMatches,
      matches,
    });
  },
};
