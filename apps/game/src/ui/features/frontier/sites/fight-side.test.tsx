import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { formatShort } from "@bibliothecadao/types";

import { FightSide, fightFigures, type Kept } from "./fight-side";

const drawn = (before: number | undefined, kept: Kept, side: "ours" | "theirs" = "ours") =>
  new DOMParser().parseFromString(
    renderToStaticMarkup(<FightSide label="Army" mark={null} before={before} kept={kept} side={side} />),
    "text/html",
  );

/** The bar's parts in a side as drawn: each one's colour (paler where the dice may keep it) and width. */
const bar = (page: Document) =>
  [...page.querySelectorAll(".rounded-full.bg-hud-well > span")].map((part) => ({
    colour: `${part.className.includes("bg-hud-good") ? "green" : part.className.includes("bg-hud-bad") ? "red" : "grey"}${part.className.includes("opacity-50") ? " pale" : ""}`,
    width: (part as HTMLElement).style.width,
  }));

/** The side's figure lines as read: the troops before with their arrow, the troops kept, then what the fight takes. */
const lines = (page: Document) =>
  [...page.querySelectorAll('[role="img"] span[style*="font-size"]')].map((line) => line.textContent);

describe("what a fight costs a side, under its bar", () => {
  const lost = (page: Document) => lines(page).at(-1);

  it("renders the archived 3 November Blightglow result: the army's loss in red, the guard's in gold", () => {
    const army = drawn(794, 193, "ours");
    const guard = drawn(1_400, 1_033, "theirs");
    expect(lines(army)).toEqual(["794 →", "193", "−601 · 76% lost"]);
    expect(lines(guard)).toEqual(["1,400 →", "1,033", "−367 · 26% lost"]);
    expect(army.querySelector(".text-hud-bad.text-hud-label")?.textContent).toBe("−601 · 76% lost");
    expect(guard.querySelector(".text-hud-gold.text-hud-label")?.textContent).toBe("−367 · 26% lost");
    expect(army.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe("Army 794 → 193, −601 · 76% lost");
  });

  it("never reads 0% or 100% while some are lost or kept, 100% once none are kept", () => {
    expect(lost(drawn(1_000, 1))).toBe("−999 · 99% lost");
    expect(lost(drawn(1_000, 999))).toBe("−1 · 1% lost");
    expect(lost(drawn(1_200, 0))).toBe("−1,200 · 100% lost");
    expect(lost(drawn(500, 500))).toBe("None lost");
  });

  it("claims no loss while the fight or the side's troops are not known", () => {
    expect(lines(drawn(7_100, undefined))).toEqual(["7,100 →", "—"]);
    expect(lines(drawn(undefined, 300))).toEqual(["— →", "300"]);
  });
});

describe("one side of a fight", () => {
  it("keeps the player's troops left in green and greys what the fight takes", () => {
    const page = drawn(1_089, 682);
    expect(lines(page)).toEqual(["1,089 →", "682", "−407 · 37% lost"]);
    expect(bar(page)).toEqual([
      { colour: "green", width: `${(682 / 1_089) * 100}%` },
      { colour: "grey", width: `${(1 - 682 / 1_089) * 100}%` },
    ]);
  });

  it("draws the enemy in red, all grey once it is gone", () => {
    expect(bar(drawn(1_100, 0, "theirs"))).toEqual([
      { colour: "red", width: "0%" },
      { colour: "grey", width: "100%" },
    ]);
  });

  it("shows a dash and an empty bar where no forecast is known, never a loss it does not know", () => {
    const page = drawn(7_100, undefined);
    expect(lines(page)).toEqual(["7,100 →", "—"]);
    expect(bar(page)).toEqual([]);
    expect(page.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe("Army 7,100 → —");
  });

  it("reads what the dice decide low to high, the part they may keep paler on the bar", () => {
    const page = drawn(5_000, { low: 3_900, high: 4_006 });
    expect(lines(page)).toEqual(["5,000 →", "3,900–4,006", "−994–1,100 · 20–22% lost"]);
    expect(bar(page)).toEqual([
      { colour: "green", width: `${(3_900 / 5_000) * 100}%` },
      { colour: "green pale", width: `${(4_006 / 5_000 - 3_900 / 5_000) * 100}%` },
      { colour: "grey", width: `${(1 - 4_006 / 5_000) * 100}%` },
    ]);
    expect(page.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe(
      "Army 5,000 → 3,900 to 4,006, −994–1,100 · 20–22% lost",
    );
  });

  it("names both figures exactly to a screen reader, whatever their size", () => {
    expect(drawn(1_284_500, 1_068_100).querySelector('[role="img"]')?.getAttribute("aria-label")).toBe(
      "Army 1,284,500 → 1,068,100, −216,400 · 17% lost",
    );
  });

  it("writes a side's figures exactly up to eight digits", () => {
    expect(fightFigures(4_291, { low: 3_475, high: 3_475 })).toEqual({
      before: "4,291",
      kept: "3,475",
      lost: "−816 · 19% lost",
    });
    expect(fightFigures(9_999_999, { low: 1_068_100, high: 1_068_100 })).toEqual({
      before: "9,999,999",
      kept: "1,068,100",
      lost: "−8,931,899 · 89% lost",
    });
  });

  it("writes them short from ten million, exactly again when two of them would read alike", () => {
    expect(fightFigures(123_456_789, { low: 98_765_432, high: 98_765_432 })).toEqual({
      before: formatShort(123_456_789),
      kept: formatShort(98_765_432),
      lost: `−${formatShort(24_691_357)} · 20% lost`,
    });
    expect(fightFigures(12_345_678, { low: 12_340_000, high: 12_340_000 })).toEqual({
      before: "12,345,678",
      kept: "12,340,000",
      lost: "−5,678 · 1% lost",
    });
  });
});
