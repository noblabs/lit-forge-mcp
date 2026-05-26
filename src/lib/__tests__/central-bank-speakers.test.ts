import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ffDateToIso,
  ffImpactToImportance,
  extractSurname,
  isSpeechEvent,
  parseFfEvents,
  selectSpeakers,
  toSpeaker,
} from "../central-bank-speakers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE = readFileSync(join(__dirname, "fixtures", "ff-calendar-sample.xml"), "utf-8");

describe("FF パース・正規化ヘルパー", () => {
  it("isSpeechEvent は発言系のみ true", () => {
    expect(isSpeechEvent("FOMC Member Logan Speaks")).toBe(true);
    expect(isSpeechEvent("BOJ Gov Ueda Speech")).toBe(true);
    expect(isSpeechEvent("Fed Chair Warsh Testimony")).toBe(true);
    expect(isSpeechEvent("CPI m/m")).toBe(false);
    expect(isSpeechEvent("Bank Holiday")).toBe(false);
  });

  it("extractSurname は発言動詞を落として末尾の語を返す", () => {
    expect(extractSurname("FOMC Member Logan Speaks")).toBe("Logan");
    expect(extractSurname("BOJ Gov Ueda Speaks")).toBe("Ueda");
    expect(extractSurname("ECB President Lagarde Speaks")).toBe("Lagarde");
    expect(extractSurname("Fed Chair Warsh Speaks")).toBe("Warsh");
  });

  it("ffDateToIso は MM-DD-YYYY → YYYY-MM-DD", () => {
    expect(ffDateToIso("05-27-2026")).toBe("2026-05-27");
    expect(ffDateToIso("12-01-2026")).toBe("2026-12-01");
    expect(ffDateToIso("bad")).toBeNull();
  });

  it("ffImpactToImportance は High/Medium/その他 を 3/2/1 に", () => {
    expect(ffImpactToImportance("High")).toBe(3);
    expect(ffImpactToImportance("Medium")).toBe(2);
    expect(ffImpactToImportance("Low")).toBe(1);
    expect(ffImpactToImportance("Holiday")).toBe(1);
    expect(ffImpactToImportance("")).toBe(1);
  });

  it("parseFfEvents はフィクスチャの 10 イベントを抽出", () => {
    const events = parseFfEvents(SAMPLE);
    expect(events).toHaveLength(10);
    const speeches = events.filter((e) => isSpeechEvent(e.title));
    expect(speeches).toHaveLength(8); // Logan/Cook/Goolsbee/Ueda/Warsh/Lagarde/Zeta/Kashkari
  });
});

describe("toSpeaker の enrich", () => {
  it("米投票メンバー（ローテーション地区連銀）は role/投票権付き・★★に引き上げ", () => {
    const s = toSpeaker({ title: "FOMC Member Logan Speaks", country: "USD", date: "05-27-2026", time: "9:00am", impact: "Low" });
    expect(s).not.toBeNull();
    expect(s!.country).toBe("US");
    expect(s!.org).toBe("FRB");
    expect(s!.speaker).toBe("Logan");
    expect(s!.role).toBe("ダラス連銀総裁");
    expect(s!.votingMember).toBe(true);
    expect(s!.votingStatus).toBe("投票権あり");
    expect(s!.importance).toBe(2); // FF Low だが投票メンバーで ★★ に
  });

  it("米理事（Cook）は FRB理事・投票権あり・★★", () => {
    const s = toSpeaker({ title: "FOMC Member Cook Speaks", country: "USD", date: "05-27-2026", time: "10:00am", impact: "Low" })!;
    expect(s.role).toBe("FRB理事");
    expect(s.votingMember).toBe(true);
    expect(s.importance).toBe(2);
  });

  it("米非投票（Goolsbee）は投票権なし・FF Low のまま ★", () => {
    const s = toSpeaker({ title: "FOMC Member Goolsbee Speaks", country: "USD", date: "05-27-2026", time: "12:00pm", impact: "Low" })!;
    expect(s.role).toBe("シカゴ連銀総裁");
    expect(s.votingMember).toBe(false);
    expect(s.votingStatus).toBe("投票権なし");
    expect(s.importance).toBe(1);
  });

  it("議長（Warsh）は ★★★", () => {
    const s = toSpeaker({ title: "Fed Chair Warsh Speaks", country: "USD", date: "05-28-2026", time: "2:00pm", impact: "Low" })!;
    expect(s.role).toBe("FRB議長");
    expect(s.importance).toBe(3);
  });

  it("名簿外の米発言者は role/投票権なしで素通し（importance は FF impact 由来）", () => {
    const s = toSpeaker({ title: "FOMC Member Zeta Speaks", country: "USD", date: "05-28-2026", time: "3:00pm", impact: "Medium" })!;
    expect(s.speaker).toBe("Zeta");
    expect(s.role).toBeUndefined();
    expect(s.votingMember).toBeUndefined();
    expect(s.importance).toBe(2); // FF Medium
  });

  it("非米（BOJ Ueda）は org=日銀・投票権 enrich なし", () => {
    const s = toSpeaker({ title: "BOJ Gov Ueda Speaks", country: "JPY", date: "05-27-2026", time: "6:00am", impact: "Medium" })!;
    expect(s.country).toBe("JP");
    expect(s.org).toBe("日銀");
    expect(s.role).toBeUndefined();
    expect(s.votingMember).toBeUndefined();
    expect(s.importance).toBe(2);
  });

  it("発言系でない・日付不正は null", () => {
    expect(toSpeaker({ title: "CPI m/m", country: "USD", date: "05-27-2026", time: "8:30am", impact: "High" })).toBeNull();
    expect(toSpeaker({ title: "FOMC Member Logan Speaks", country: "USD", date: "bad", time: "9:00am", impact: "Low" })).toBeNull();
  });
});

describe("selectSpeakers の期間・国フィルタ", () => {
  const events = parseFfEvents(SAMPLE);

  it("range=today は当日の発言のみ（指標・休場は除外）", () => {
    const out = selectSpeakers(events, { range: "today", today: "2026-05-27" });
    const names = out.map((s) => s.speaker).sort();
    expect(names).toEqual(["Cook", "Goolsbee", "Logan", "Ueda"]);
    // 指標(CPI)・休場(Holiday)は混ざらない
    expect(out.every((s) => !s.rawTitle.includes("CPI"))).toBe(true);
  });

  it("range=week は当日〜+6 日（06-10 の Kashkari は範囲外）", () => {
    const out = selectSpeakers(events, { range: "week", today: "2026-05-27" });
    const names = out.map((s) => s.speaker).sort();
    expect(names).toEqual(["Cook", "Goolsbee", "Lagarde", "Logan", "Ueda", "Warsh", "Zeta"]);
    expect(names).not.toContain("Kashkari");
  });

  it("countries=US で非米（Ueda/Lagarde）を除外", () => {
    const out = selectSpeakers(events, { range: "week", today: "2026-05-27", countries: ["US"] });
    expect(out.every((s) => s.country === "US")).toBe(true);
    expect(out.map((s) => s.speaker)).not.toContain("Ueda");
    expect(out.map((s) => s.speaker)).not.toContain("Lagarde");
  });

  it("日付昇順 → 重要度降順でソートされる", () => {
    const out = selectSpeakers(events, { range: "week", today: "2026-05-27" });
    for (let i = 1; i < out.length; i++) {
      const prev = out[i - 1];
      const cur = out[i];
      expect(prev.date <= cur.date).toBe(true);
      if (prev.date === cur.date) {
        expect(prev.importance >= cur.importance).toBe(true);
      }
    }
  });
});
