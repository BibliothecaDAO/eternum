import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { TroopType } from "@bibliothecadao/types";
import { CombatMark } from "./combat-mark";

it("draws every native troop as a blade or bow", () => {
  const expected = { Knight: "Blade", Paladin: "Blade", Crossbowman: "Bow" } satisfies Record<TroopType, string>;
  for (const category of Object.values(TroopType)) {
    expect(renderToStaticMarkup(<CombatMark category={category} />)).toContain(`data-combat-mark="${expected[category]}"`);
  }
});
