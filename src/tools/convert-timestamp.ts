// Unix タイムスタンプと ISO 日時を相互変換。

import { z } from "zod";
import { errorReply, jsonReply, type LitForgeTool } from "./types.js";

const inputSchema = {
  value: z
    .string()
    .describe("変換する値。to_iso なら数値文字列、to_unix なら ISO 日時"),
  mode: z
    .enum(["to_iso", "to_unix"])
    .describe("to_iso: Unix→ISO / to_unix: ISO→Unix"),
  unit: z
    .enum(["seconds", "milliseconds"])
    .default("seconds")
    .describe("Unix 時刻の単位（既定 seconds）"),
};

export const convertTimestamp: LitForgeTool = {
  name: "convert_timestamp",
  title: "タイムスタンプ変換",
  description:
    "Unix タイムスタンプ（秒またはミリ秒）と ISO 8601 日時を相互変換します。タイムゾーンは UTC で扱います。",
  inputSchema,
  handler: ({ value, mode, unit }) => {
    if (mode === "to_iso") {
      const num = Number(value);
      if (!Number.isFinite(num)) {
        return errorReply(`数値として解釈できません: ${value}`);
      }
      const ms = unit === "seconds" ? num * 1000 : num;
      const date = new Date(ms);
      if (Number.isNaN(date.getTime())) {
        return errorReply(`日時として解釈できません: ${value}`);
      }
      return jsonReply({
        iso: date.toISOString(),
        utc: date.toUTCString(),
        unix: unit === "seconds" ? num : Math.floor(num / 1000),
        unixMs: ms,
      });
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return errorReply(`ISO 日時として解釈できません: ${value}`);
    }
    const unix = Math.floor(date.getTime() / 1000);
    return jsonReply({
      unix,
      unixMs: date.getTime(),
      iso: date.toISOString(),
      result: unit === "seconds" ? unix : date.getTime(),
    });
  },
};
