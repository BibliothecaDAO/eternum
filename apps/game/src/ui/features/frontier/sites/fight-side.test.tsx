import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { formatShort } from "@bibliothecadao/types";

import { FightSide, fightFigures, type Kept } from "./fight-side";

const drawn = (before: number | undefined, kept: Kept, side: "ours" | "theirs" = "ours") =>
  new DOMParser().parseFromString(
    renderToStaticMarkup(<FightSide label="Army" mark={null} before={before} kept={kept} side={side} />),
    "text/html",
  );

const read = (page: Document) => ({
  nums: page.querySelector(".fight-side__nums")?.textContent,
  taken: page.querySelector(".fight-side__taken")?.textContent,
  tone: page.querySelector(".fight-side__taken")?.getAttribute("data-tone"),
});
const spoken = (page: Document) => page.querySelector('[role="img"]')?.getAttribute("aria-label");

describe("what a fight costs a side", () => {
  it("reads the owner's Blightglow Rift: the army's loss in red, the guard's in green", () => {
    expect(read(drawn(794, 193, "ours"))).toEqual({ nums: "794 → 193", taken: "−601", tone: "bad" });
    expect(read(drawn(1_400, 1_033, "theirs"))).toEqual({ nums: "1,400 → 1,033", taken: "−367", tone: "good" });
    expect(spoken(drawn(794, 193))).toBe("Army 794 → 193, −601 · 76% lost");
  });

  it("says a guard left with none is Defeated, and greys its painting", () => {
    const page = drawn(1_000, 0, "theirs");
    expect(read(page)).toEqual({ nums: "1,000 → 0", taken: "Defeated", tone: "good" });
    expect(page.querySelector(".fight-side--gone")).not.toBeNull();
    expect(drawn(1_000, 0, "ours").querySelector(".fight-side--gone")).toBeNull();
  });

  it("never says 0% or 100% while some are lost or kept, 100% once none are kept", () => {
    expect(spoken(drawn(1_000, 1))).toBe("Army 1,000 → 1, −999 · 99% lost");
    expect(spoken(drawn(1_000, 999))).toBe("Army 1,000 → 999, −1 · 1% lost");
    expect(spoken(drawn(1_200, 0))).toBe("Army 1,200 → 0, −1,200 · 100% lost");
    expect(read(drawn(500, 500)).taken).toBe("None lost");
  });

  it("claims no loss while the fight or the side's troops are not known", () => {
    expect(read(drawn(7_100, undefined))).toEqual({ nums: "7,100 → —", taken: undefined, tone: undefined });
    expect(read(drawn(undefined, 300)).nums).toBe("— → 300");
    expect(spoken(drawn(7_100, undefined))).toBe("Army 7,100 → —");
  });

  it("names both figures exactly to a screen reader, whatever their size", () => {
    expect(spoken(drawn(1_284_500, 1_068_100))).toBe("Army 1,284,500 → 1,068,100, −216,400 · 17% lost");
  });
});

describe("a side's figures", () => {
  it("writes them exactly up to eight digits", () => {
    expect(fightFigures(4_291, 3_475)).toEqual({
      before: "4,291",
      kept: "3,475",
      taken: "−816",
      lost: "−816 · 19% lost",
    });
    expect(fightFigures(9_999_999, 1_068_100)).toEqual({
      before: "9,999,999",
      kept: "1,068,100",
      taken: "−8,931,899",
      lost: "−8,931,899 · 89% lost",
    });
  });

  it("writes them short from ten million, exactly again when two of them would read alike", () => {
    expect(fightFigures(123_456_789, 98_765_432)).toEqual({
      before: formatShort(123_456_789),
      kept: formatShort(98_765_432),
      taken: `−${formatShort(24_691_357)}`,
      lost: `−${formatShort(24_691_357)} · 20% lost`,
    });
    expect(fightFigures(12_345_678, 12_340_000)).toEqual({
      before: "12,345,678",
      kept: "12,340,000",
      taken: "−5,678",
      lost: "−5,678 · 1% lost",
    });
  });
});
