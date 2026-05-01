import { describe, expect, it } from "vitest";
import { getSessionStatuses } from "../sessions.js";

// JST 時刻指定用ヘルパ：JST H 時の UTC 換算時刻を作る
function atJst(hourJst: number, dow: "mon" | "tue" | "fri" | "sat" | "sun" = "mon"): Date {
  // 2026-05-04 (月) 00:00 JST = 2026-05-03 15:00 UTC
  const baseDates: Record<typeof dow, string> = {
    mon: "2026-05-04T00:00:00+09:00",
    tue: "2026-05-05T00:00:00+09:00",
    fri: "2026-05-08T00:00:00+09:00",
    sat: "2026-05-09T00:00:00+09:00",
    sun: "2026-05-10T00:00:00+09:00",
  };
  const base = new Date(baseDates[dow]).getTime();
  return new Date(base + hourJst * 3600 * 1000);
}

describe("getSessionStatuses", () => {
  it("月曜 12:00 JST：東京と上海はオープン、他はクローズ", () => {
    const out = getSessionStatuses(atJst(12, "mon"));
    expect(out.find((s) => s.session.id === "tokyo")?.state).toBe("open");
    expect(out.find((s) => s.session.id === "shanghai")?.state).toBe("open");
    expect(out.find((s) => s.session.id === "london")?.state).toBe("closed");
    expect(out.find((s) => s.session.id === "ny")?.state).toBe("closed");
  });

  it("月曜 23:00 JST：NY とロンドンがオープン", () => {
    const out = getSessionStatuses(atJst(23, "mon"));
    expect(out.find((s) => s.session.id === "ny")?.state).toBe("open");
    expect(out.find((s) => s.session.id === "london")?.state).toBe("open");
    expect(out.find((s) => s.session.id === "tokyo")?.state).toBe("closed");
  });

  it("月曜 8:50 JST：東京は pre-open（10 分後にオープン）", () => {
    const out = getSessionStatuses(atJst(8 + 50 / 60, "mon"));
    const tokyo = out.find((s) => s.session.id === "tokyo");
    expect(tokyo?.state).toBe("pre-open");
    expect(tokyo?.hoursUntilOpen).toBeDefined();
  });

  it("土曜は全市場 closed", () => {
    const out = getSessionStatuses(atJst(10, "sat"));
    for (const s of out) expect(s.state).toBe("closed");
  });

  it("日曜は全市場 closed", () => {
    const out = getSessionStatuses(atJst(15, "sun"));
    for (const s of out) expect(s.state).toBe("closed");
  });
});
