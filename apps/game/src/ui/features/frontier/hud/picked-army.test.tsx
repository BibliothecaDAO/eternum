// @vitest-environment jsdom
import bindings from "../../../../../../../contracts/l3/world-native/schema/bindings.json";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { ATTRIBUTE_LIST } from "../army/army-detail";
import { PickedArmy } from "./picked-army";

/** The attributes an army levels, as the generated game schema lists them (progression::SkillPointUse, excluding its Stamina purchase). */
const schemaAttributes = bindings.commandAbi
  .find((entry) => entry.name === "world_native::progression::SkillPointUse")!
  .variants!.map(({ name }) => name)
  .filter((name) => name !== "Stamina");

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
          canSpendSkillPoint: false,
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
    expect(ATTRIBUTE_LIST.map(({ attribute }) => attribute)).toEqual(schemaAttributes);
    expect(Object.keys(RANKS)).toEqual(schemaAttributes);
  });

  it("shows untrained attributes at rank 0 without a Common gem", () => {
    const view = render(Object.fromEntries(schemaAttributes.map((name) => [name.toLowerCase(), 0])));
    for (const name of schemaAttributes) {
      const side = view.host.querySelector(`[data-picked-army] [aria-label="${name} 0"]`)!;
      expect(side).not.toBeNull();
      expect(side.querySelector('.ui-tier[data-tier="0"]')?.getAttribute("aria-label")).toBe("Untrained");
      expect(side.querySelector(".ui-tier")?.textContent).toBe("");
    }
    view.unmount();
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
