import { describe, expect, it } from "vitest";
import {
  FOMC_ROSTER,
  lookupFomcMember,
} from "../fomc-roster.js";

describe("FOMC 名簿 (fomc-roster) のデータ整合", () => {
  const members = Object.values(FOMC_ROSTER);

  it("理事は 7 名で全員が投票メンバー", () => {
    const governors = members.filter((m) => m.kind === "governor");
    expect(governors).toHaveLength(7);
    expect(governors.every((m) => m.votingMember)).toBe(true);
  });

  it("FOMC 投票メンバーは合計 12 名（理事 7 + NY + ローテーション 4）", () => {
    const voters = members.filter((m) => m.votingMember);
    expect(voters).toHaveLength(12);
  });

  it("投票する地区連銀総裁は 5 名（NY 常任 + ローテーション 4）", () => {
    const regionalVoters = members.filter((m) => m.kind === "regional" && m.votingMember);
    expect(regionalVoters).toHaveLength(5);
    // NY は常任で投票
    expect(FOMC_ROSTER.williams.votingMember).toBe(true);
  });

  it("議長はちょうど 1 名（Warsh）", () => {
    const chairs = members.filter((m) => m.isChair);
    expect(chairs).toHaveLength(1);
    expect(FOMC_ROSTER.warsh.isChair).toBe(true);
    expect(FOMC_ROSTER.warsh.roleJa).toBe("FRB議長");
  });

  it("キーは小文字の名字で、lookup は大文字小文字を無視する", () => {
    for (const [key, m] of Object.entries(FOMC_ROSTER)) {
      expect(key).toBe(m.surname.toLowerCase());
    }
    expect(lookupFomcMember("LOGAN")?.roleJa).toBe("ダラス連銀総裁");
    expect(lookupFomcMember("  cook  ")?.roleJa).toBe("FRB理事");
    expect(lookupFomcMember("NoSuchPerson")).toBeUndefined();
  });

  it("2026 ローテーション入りの 4 地区連銀総裁が投票メンバー", () => {
    for (const name of ["paulson", "hammack", "logan", "kashkari"]) {
      expect(FOMC_ROSTER[name].votingMember, `${name} は 2026 投票メンバーのはず`).toBe(true);
    }
  });

  it("2026 ローテーション抜けの地区連銀総裁は非投票", () => {
    for (const name of ["collins", "goolsbee", "musalem", "schmid"]) {
      expect(FOMC_ROSTER[name].votingMember, `${name} は 2026 非投票のはず`).toBe(false);
    }
  });
});
