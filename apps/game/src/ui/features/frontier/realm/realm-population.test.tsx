// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import { GameProvider } from "@/hooks/context/game-context";
import type { GameClientSetup, NativeRows } from "@bibliothecadao/eternum/game-client";

import { realmBoard } from "../build/build-fixture";
import { RealmPanel } from "../hud/realm-panel";
import { useRealmPopulation } from "./realm-population";

/** The realm panel as the HUD feeds it: the realm's population read from its buildings' row. */
const Panel = ({ realm }: { realm: NativeRows["Structure"] }) => (
  <RealmPanel name="Duskbite" level={1} population={useRealmPopulation(realm)} stores={[]} />
);

/** The realm's buildings row, its buildings taking `current` of the population its Huts give. */
const buildingsTaking = (current: number) =>
  [
    {
      model: "StructureBuildings",
      key: "0x72",
      value: {
        game_id: 1,
        entity_id: 7,
        packed_counts_1: "0",
        packed_counts_2: "0",
        packed_counts_3: "0",
        population: { current, max: 6 },
      },
    },
  ] as never;

it("reads the realm's population on its panel as Blitz reads a holding's: used of all its castle and Huts give", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { store, realm } = realmBoard();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
        <Panel realm={realm} />
      </GameProvider>,
    ),
  );
  const population = () => host.querySelector("[data-tip^='Population']");
  // The board's Huts give 6 and the castle the preset's base 6; no building takes any yet.
  expect([population()?.textContent, population()?.getAttribute("data-tip")]).toEqual(["0/12", "Population 0 of 12"]);

  // A farm stands: it takes its population, and the panel reads it.
  act(() => store.applyFacts(buildingsTaking(3)));
  expect(population()?.textContent).toBe("3/12");

  act(() => root.unmount());
  host.remove();
});
