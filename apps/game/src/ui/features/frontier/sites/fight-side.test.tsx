import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { formatShort } from "@bibliothecadao/types";

import { FightSide, fightFigures } from "./fight-side";

/** The bar's parts in a side as drawn: each one's colour and width. */
const parts = (markup: string) =>
  [...new DOMParser().parseFromString(markup, "text/html").querySelectorAll(".rounded-full.bg-hud-well > span")].map(
    (part) => ({
      colour: part.className.includes("bg-hud-good")
        ? "green"
        : part.className.includes("bg-hud-bad")
          ? "red"
          : part.className.includes("bg-hud-neutral")
            ? "grey"
            : part.className,
      width: (part as HTMLElement).style.width,
    }),
  );

describe("a side's bar through a fight", () => {
  it("keeps the player's troops left in green and greys what the fight takes", () => {
    expect(
      parts(renderToStaticMarkup(<FightSide label="Army" mark={null} before={1_089} after={682} side="ours" />)),
    ).toEqual([
      { colour: "green", width: `${(682 / 1_089) * 100}%` },
      { colour: "grey", width: `${(1 - 682 / 1_089) * 100}%` },
    ]);
  });

  it("draws the enemy in red, all grey once it is gone", () => {
    expect(
      parts(renderToStaticMarkup(<FightSide label="Troll" mark={null} before={1_100} after={0} side="theirs" />)),
    ).toEqual([
      { colour: "red", width: "0%" },
      { colour: "grey", width: "100%" },
    ]);
  });

  it("names both figures exactly to a screen reader, whatever their size", () => {
    const markup = renderToStaticMarkup(
      <FightSide label="Army" mark={null} before={1_284_500} after={1_068_100} side="ours" />,
    );
    const side = new DOMParser().parseFromString(markup, "text/html").querySelector('[role="img"]');
    expect(side?.getAttribute("aria-label")).toBe("Army 1,284,500 → 1,068,100");
  });

  it("writes a side's figures exactly up to eight digits", () => {
    expect(fightFigures(4_291, 3_475)).toEqual({ before: "4,291", after: "3,475" });
    expect(fightFigures(9_999_999, 1_068_100)).toEqual({ before: "9,999,999", after: "1,068,100" });
  });

  it("writes them short from ten million, exactly again when the short ones would read alike", () => {
    expect(fightFigures(123_456_789, 98_765_432)).toEqual({
      before: formatShort(123_456_789),
      after: formatShort(98_765_432),
    });
    expect(fightFigures(123_456_789, 98_765_432).before).toMatch(/^123\.?\d*M$/);
    expect(fightFigures(12_345_678, 12_340_000)).toEqual({ before: "12,345,678", after: "12,340,000" });
  });
});
