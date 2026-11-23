import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { resolveFirstStrike } from "@bibliothecadao/eternum";
import { TroopType } from "@bibliothecadao/types";
import { CombatMark } from "./combat-mark";

it("draws every native troop as a blade or bow", () => {
  const expected = { Knight: "Blade", Paladin: "Blade", Crossbowman: "Bow" } satisfies Record<TroopType, string>;
  for (const category of Object.values(TroopType)) {
    expect(renderToStaticMarkup(<CombatMark category={category} />)).toContain(
      `data-combat-mark="${expected[category]}"`,
    );
  }
});

it("marks Bow as hitting first only against Blade through the core rule", () => {
  expect(resolveFirstStrike("Crossbowman", "Knight")).toBe("attacker");
  expect(resolveFirstStrike("Knight", "Crossbowman")).toBe("defender");
  expect(resolveFirstStrike("Knight", "Knight")).toBeNull();
  expect(resolveFirstStrike("Crossbowman", "Crossbowman")).toBeNull();
});
