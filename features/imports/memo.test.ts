import { describe, expect, it } from "vitest";

import { memoWithoutSenderBlock } from "./memo";

describe("memoWithoutSenderBlock", () => {
  it("drops the bank's appended counterparty block", () => {
    expect(
      memoWithoutSenderBlock(
        "Х.ЕСҮЙ, Х.ЕСҮХЭЙ ТӨЛБӨР (ГОЛОМТ БАНК БААСАНСҮРЭН БАТМӨНХ)",
      ),
    ).toBe("Х.ЕСҮЙ, Х.ЕСҮХЭЙ ТӨЛБӨР");
    expect(
      memoWithoutSenderBlock("BUS 11A KHERLEN (ХААН БАНК МЯГМАРСҮРЭН УЯНГАА)"),
    ).toBe("BUS 11A KHERLEN");
  });

  it("drops a chain of them when a transfer passed through two institutions", () => {
    expect(
      memoWithoutSenderBlock(
        "MM:8C Temuujin Misheel bus (ТӨРИЙН БАНК И ЭС ЭМ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ БСБ) (АРД КРЕДИТ ББСБ БАДАМ БАТЦЭЦЭГ)",
      ),
    ).toBe("MM:8C Temuujin Misheel bus");
  });

  it("recognises the Latin spellings too", () => {
    expect(memoWithoutSenderBlock("BOLOR NAIDAN 5MA (M BANK ПҮРЭВДОРЖ НАЙДАН)")).toBe(
      "BOLOR NAIDAN 5MA",
    );
  });

  it("keeps parentheses the payer wrote", () => {
    expect(memoWithoutSenderBlock("TANAKA KANON 8E BUS (TERM4)")).toBe(
      "TANAKA KANON 8E BUS (TERM4)",
    );
    expect(memoWithoutSenderBlock("BOLOR NAIDAN 5MA (FOR 6TH CLASS)")).toBe(
      "BOLOR NAIDAN 5MA (FOR 6TH CLASS)",
    );
  });

  it("keeps a memo that is nothing but a bank block", () => {
    // Blanking the cell would be worse than leaving it redundant.
    expect(memoWithoutSenderBlock("(ХААН БАНК ДЭРЭМ АРИУНЖАРГАЛ)")).toBe(
      "(ХААН БАНК ДЭРЭМ АРИУНЖАРГАЛ)",
    );
  });

  it("leaves an ordinary memo, an empty one, and null alone", () => {
    expect(memoWithoutSenderBlock("Erdembileg.B, 3CL. Bus")).toBe(
      "Erdembileg.B, 3CL. Bus",
    );
    expect(memoWithoutSenderBlock("")).toBe("");
    expect(memoWithoutSenderBlock(null)).toBeNull();
  });
});
