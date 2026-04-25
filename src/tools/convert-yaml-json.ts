// YAML ⇔ JSON 相互変換。

import yaml from "js-yaml";
import { z } from "zod";
import { errorReply, jsonReply, type LitForgeTool } from "./types.js";

const inputSchema = {
  text: z.string().describe("変換元のテキスト"),
  mode: z
    .enum(["yaml_to_json", "json_to_yaml"])
    .describe("yaml_to_json: YAML→JSON / json_to_yaml: JSON→YAML"),
  indent: z
    .number()
    .int()
    .min(0)
    .max(8)
    .default(2)
    .describe("出力のインデント幅（YAML/JSON 共通、0〜8）"),
};

export const convertYamlJson: LitForgeTool = {
  name: "convert_yaml_json",
  title: "YAML ⇔ JSON 変換",
  description:
    "YAML と JSON を相互変換します。YAML は js-yaml に準拠、JSON は標準 JSON.stringify を使います。",
  inputSchema,
  handler: ({ text, mode, indent }) => {
    const trimmed = text.trim();
    if (!trimmed) return jsonReply({ result: "" });

    try {
      if (mode === "yaml_to_json") {
        const obj = yaml.load(trimmed);
        return jsonReply({ result: JSON.stringify(obj, null, indent) });
      }
      const obj = JSON.parse(trimmed);
      const result = yaml.dump(obj, {
        indent,
        sortKeys: false,
        lineWidth: -1,
        noRefs: true,
      });
      return jsonReply({ result });
    } catch (e) {
      return errorReply(
        `${mode === "yaml_to_json" ? "YAML" : "JSON"} のパースに失敗: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  },
};
