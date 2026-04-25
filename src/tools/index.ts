// 全ツールを集約してエクスポート。新しいツール追加時はここに 1 行足す。

import { formatJson } from "./format-json.js";
import { testRegex } from "./test-regex.js";
import { decodeJwt } from "./decode-jwt.js";
import { convertBase64 } from "./convert-base64.js";
import { convertUrl } from "./convert-url.js";
import { generateHash } from "./generate-hash.js";
import { generateUuid } from "./generate-uuid.js";
import { convertTimestamp } from "./convert-timestamp.js";
import { convertYamlJson } from "./convert-yaml-json.js";
import { describeCron } from "./describe-cron.js";

export const tools = [
  formatJson,
  testRegex,
  decodeJwt,
  convertBase64,
  convertUrl,
  generateHash,
  generateUuid,
  convertTimestamp,
  convertYamlJson,
  describeCron,
];
