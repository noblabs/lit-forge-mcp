import { describe, expect, it } from "vitest";
import { recommendationLabel } from "../yahoo.js";

describe("recommendationLabel", () => {
  it("strong_buy → 強気買い", () => {
    expect(recommendationLabel("strong_buy")).toBe("強気買い");
  });

  it("buy / outperform → 買い", () => {
    expect(recommendationLabel("buy")).toBe("買い");
    expect(recommendationLabel("outperform")).toBe("買い");
  });

  it("hold / neutral → 中立", () => {
    expect(recommendationLabel("hold")).toBe("中立");
    expect(recommendationLabel("neutral")).toBe("中立");
  });

  it("sell / underperform → 売り", () => {
    expect(recommendationLabel("sell")).toBe("売り");
    expect(recommendationLabel("underperform")).toBe("売り");
  });

  it("strong_sell → 強気売り", () => {
    expect(recommendationLabel("strong_sell")).toBe("強気売り");
  });

  it("大文字混在も正規化", () => {
    expect(recommendationLabel("STRONG_BUY")).toBe("強気買い");
    expect(recommendationLabel("Buy")).toBe("買い");
  });

  it("undefined / 空文字 → undefined", () => {
    expect(recommendationLabel(undefined)).toBeUndefined();
    expect(recommendationLabel("")).toBeUndefined();
  });

  it("未知のキー → undefined", () => {
    expect(recommendationLabel("super_buy")).toBeUndefined();
  });
});
