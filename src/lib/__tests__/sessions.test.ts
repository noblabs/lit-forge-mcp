import { describe, expect, it } from "vitest";
import { getSessionStatuses } from "../sessions.js";

// JST 時刻指定用ヘルパ：JST H 時の UTC 換算時刻を作る
// 注意: GW (5/4-5/6) は祝日テストと衝突するため、5/11 以降を基準にする
function atJst(hourJst: number, dow: "mon" | "tue" | "fri" | "sat" | "sun" = "mon"): Date {
  const baseDates: Record<typeof dow, string> = {
    mon: "2026-05-11T00:00:00+09:00",
    tue: "2026-05-12T00:00:00+09:00",
    fri: "2026-05-15T00:00:00+09:00",
    sat: "2026-05-16T00:00:00+09:00",
    sun: "2026-05-17T00:00:00+09:00",
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

  // ============ 祝日対応（v0.5.0〜） ============
  it("2026-05-06（振替休日）水曜 12:00 JST：東京は holiday", () => {
    // 2026-05-06 (Wed) は GW 振替休日
    const date = new Date("2026-05-06T03:00:00Z"); // = 12:00 JST
    const out = getSessionStatuses(date);
    const tokyo = out.find((s) => s.session.id === "tokyo");
    expect(tokyo?.state).toBe("holiday");
    expect(tokyo?.holidayName).toContain("振替休日");
  });

  it("2026-12-25（Christmas）金曜 23:00 JST：NY と London が holiday", () => {
    // 2026-12-25 (Fri) Christmas = NY/London 共に休場
    const date = new Date("2026-12-25T14:00:00Z"); // = 23:00 JST
    const out = getSessionStatuses(date);
    expect(out.find((s) => s.session.id === "ny")?.state).toBe("holiday");
    expect(out.find((s) => s.session.id === "london")?.state).toBe("holiday");
    // 東京・上海は通常営業時間外 (closed)
    expect(out.find((s) => s.session.id === "tokyo")?.state).toBe("closed");
  });

  it("2026-04-03（Good Friday）金曜 22:30 JST：NY は holiday（取引時間中でも override）", () => {
    const date = new Date("2026-04-03T13:30:00Z"); // = 22:30 JST
    const out = getSessionStatuses(date);
    const ny = out.find((s) => s.session.id === "ny");
    expect(ny?.state).toBe("holiday");
    expect(ny?.holidayName).toBe("Good Friday");
  });

  it("2026-11-27（Thanksgiving 翌日）金曜 03:00 JST：NY は前日 11/26 の holiday を継承", () => {
    // 2026-11-26 (Thu) Thanksgiving。NY 22:30 11/26 - 05:00 11/27 JST が休場
    // 11/27 03:00 JST は 11/26 NY 取引日内の早朝 → 前日祝日として holiday を返す
    const date = new Date("2026-11-26T18:00:00Z"); // = 11/27 03:00 JST
    const out = getSessionStatuses(date);
    const ny = out.find((s) => s.session.id === "ny");
    expect(ny?.state).toBe("holiday");
    expect(ny?.holidayName).toBe("Thanksgiving Day");
  });

  it("2026-02-17（春節）火曜 12:00 JST：上海は holiday", () => {
    const date = new Date("2026-02-17T03:00:00Z"); // = 12:00 JST
    const out = getSessionStatuses(date);
    const shanghai = out.find((s) => s.session.id === "shanghai");
    expect(shanghai?.state).toBe("holiday");
    expect(shanghai?.holidayName).toContain("春節");
  });
});
