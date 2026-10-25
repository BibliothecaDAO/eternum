import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FightBar } from "./fight-bar";

const parts = (markup: string) =>
  [...new DOMParser().parseFromString(markup, "text/html").querySelectorAll("span > span")].map((part) => ({
    colour: part.className.includes("bg-hud-good")
      ? "green"
      : part.className.includes("bg-hud-bad")
        ? "red"
        : part.className.includes("bg-hud-neutral")
          ? "grey"
          : part.className,
    width: (part as HTMLElement).style.width,
  }));

describe("a side's bar through a fight", () => {
  it("keeps the player's troops left in green and greys what the fight takes", () => {
    expect(parts(renderToStaticMarkup(<FightBar before={1_089} after={682} side="ours" />))).toEqual([
      { colour: "green", width: `${(682 / 1_089) * 100}%` },
      { colour: "grey", width: `${(1 - 682 / 1_089) * 100}%` },
    ]);
  });

  it("draws the enemy in red, all grey once it is gone", () => {
    expect(parts(renderToStaticMarkup(<FightBar before={1_100} after={0} side="theirs" />))).toEqual([
      { colour: "red", width: "0%" },
      { colour: "grey", width: "100%" },
    ]);
  });
});
