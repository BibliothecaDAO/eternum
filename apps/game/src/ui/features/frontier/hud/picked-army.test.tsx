// @vitest-environment jsdom
import schema from "../../../../../../../contracts/l3/world-native/schema/schema.json";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { ARMY_ATTRIBUTES } from "../army/army-detail";
import { PickedArmy } from "./picked-army";

/** The attributes an army levels, as the generated game schema lists them (progression::Attribute, BuyTier's). */
const schemaAttributes = schema.types["world_native::progression::Attribute"].variants.map(({ name }) => name);

/** A distinct rank for each attribute, by its schema name, so a side showing another's rank is caught. */
const RANKS: Record<string, number> = { Battle: 2, Logistics: 3, Scouting: 4, Homecoming: 5 };
const NUMERALS = ["I", "II", "III", "IV", "V"];

const render = (tiers: Record<string, number>) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <PickedArmy
        army={{
          explorerId: 1,
          label: "Army 1",
          number: 1,
          art: "knight-t1",
          xp: 0,
          xpGoal: undefined,
          stamina: { current: 60, max: 150, perExplore: 20 },
          secondsToFull: 0,
          troops: 100,
          canBuyTier: false,
          tiers: tiers as never,
        }}
        refill={null}
        onDetails={() => undefined}
        onLevelUp={() => undefined}
      />,
    ),
  );
  return { host, unmount: () => act(() => root.unmount()) };
};

describe("a phone's picked army", () => {
  it("knows every attribute the game's schema lets an army level, no more and no fewer", () => {
    expect(Object.keys(ARMY_ATTRIBUTES)).toEqual(schemaAttributes);
    expect(Object.keys(RANKS)).toEqual(schemaAttributes);
  });

  it("shows every attribute in the schema beside the token, each with its own rank", () => {
    const tiers = Object.fromEntries(schemaAttributes.map((attribute) => [attribute.toLowerCase(), RANKS[attribute]!]));
    const view = render(tiers);
    const sides = [...view.host.querySelectorAll("[data-picked-army] [role='img'][aria-label]")]
      .map((side) => side.getAttribute("aria-label"))
      .filter((label) => schemaAttributes.some((attribute) => label?.startsWith(`${attribute} `)));
    expect(sides).toEqual(schemaAttributes.map((attribute) => `${attribute} ${NUMERALS[RANKS[attribute]! - 1]}`));
    view.unmount();
  });
});
