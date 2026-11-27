import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { resolveFirstStrike } from "@bibliothecadao/eternum";
import { TroopType } from "@bibliothecadao/types";
import { BEAST_MARK_TIPS, COMBAT_MARK_WORDS } from "@/ui/design-system/kit/words";
import { BeastMarkBadge } from "./combat-mark";

it("marks every beast's class as Melee or Ranged, its tip telling strike order alone", () => {
  expect(COMBAT_MARK_WORDS).toEqual({ blade: "Melee", bow: "Ranged" });
  const expected = { Knight: "blade", Paladin: "blade", Crossbowman: "bow" } satisfies Record<
    TroopType,
    keyof typeof COMBAT_MARK_WORDS
  >;
  for (const category of Object.values(TroopType)) {
    const badge = new DOMParser().parseFromString(
      renderToStaticMarkup(<BeastMarkBadge category={category} />),
      "text/html",
    ).body.firstElementChild!;
    expect(badge.getAttribute("data-combat-mark")).toBe(COMBAT_MARK_WORDS[expected[category]]);
    expect(badge.getAttribute("data-tip")).toBe(BEAST_MARK_TIPS[expected[category]]);
  }
});

it("draws Melee and Ranged with their own paintings, never another meaning's", () => {
  expect(renderToStaticMarkup(<BeastMarkBadge category={TroopType.Knight} />)).toContain('data-icon="combat-blade"');
  expect(renderToStaticMarkup(<BeastMarkBadge category={TroopType.Crossbowman} />)).toContain('data-icon="combat-bow"');
});

it("marks Ranged as hitting first only against Melee through the core rule", () => {
  expect(resolveFirstStrike("Crossbowman", "Knight")).toBe("attacker");
  expect(resolveFirstStrike("Knight", "Crossbowman")).toBe("defender");
  expect(resolveFirstStrike("Knight", "Knight")).toBeNull();
  expect(resolveFirstStrike("Crossbowman", "Crossbowman")).toBeNull();
});
