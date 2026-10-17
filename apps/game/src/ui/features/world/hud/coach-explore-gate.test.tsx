// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const world = vi.hoisted(() => ({
  armies: [{ entityId: 70 }],
  projection: {
    getArmy: () => ({ hexCoords: { col: 4, row: 5, alt: false } }),
    getChests: () => [],
    subscribeArmies: () => () => {},
    subscribeChests: () => () => {},
  },
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentDefaultTick: () => 350, useNowMs: () => 350_000 }));
vi.mock("@/hooks/use-fact-view", () => ({
  useFactView: (view: unknown) => (view === selectableArmiesView ? world.armies : []),
}));
vi.mock("@bibliothecadao/eternum/game-sync", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getActiveGameSyncRuntime: () => ({ getWorldSpatialProjection: () => world.projection }),
}));

import { GameProvider } from "@/hooks/context/game-context";
import { selectableArmiesView } from "@/sync/fact-views";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { ArmyActionManager, setBlockTimestampSource } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import explorerFixture from "../../../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { useCoachSteps } from "./use-coach-steps";

/**
 * The deploy fixture's realm 7 with explorer 70 at full stamina, and the realm's wheat and fish held at the amounts given
 * with no production.
 */
const realmWithExplorer = (food: { wheat: string; fish: string }) => {
  const { store } = frontierDay();
  const { troops } = explorerFixture.expected.value;
  store.applyFacts([
    {
      model: "ExplorerTroops",
      key: "0x70",
      value: {
        ...explorerFixture.expected.key,
        ...explorerFixture.expected.value,
        game_id: 1,
        explorer_id: 70,
        owner: 7,
        troops: {
          ...troops,
          count: "1000000000000",
          stamina: { Inline: { amount: "150", settled_at: "350", remainder: 0 } },
        },
      },
    },
    {
      model: "ResourceBalance",
      key: "0xc",
      value: { game_id: 1, entity_id: 7, resource_type: 35, balance: food.wheat },
    },
    {
      model: "ResourceBalance",
      key: "0xe",
      value: { game_id: 1, entity_id: 7, resource_type: 36, balance: food.fish },
    },
    ...[35, 36].map((resource_type) => ({
      model: "ResourceProduction",
      key: `0xf${resource_type}`,
      value: {
        game_id: 1,
        entity_id: 7,
        resource_type,
        building_count: 0,
        production_rate: "0",
        output_amount_left: "0",
        last_settled_at: 350,
      },
    })),
  ] as never);
  return store;
};

const coachLines = (store: ReturnType<typeof realmWithExplorer>): string => {
  const Probe = () => (
    <p>
      {useCoachSteps()
        .map((step) => step.line)
        .join(" | ")}
    </p>
  );
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
        <Probe />
      </GameProvider>,
    ),
  );
  const lines = host.textContent ?? "";
  act(() => root.unmount());
  return lines;
};

afterEach(() => setBlockTimestampSource(null));

it("tells an army it can explore only when the explore order's own rule lets it: stamina and its home's food", () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.history.replaceState({}, "", "/g/0xa1/1/map");

  const hungry = realmWithExplorer({ wheat: "0", fish: "0" });
  expect(new ArmyActionManager(hungry, {} as never, 70).canExplore(350)).toBe(false);
  expect(coachLines(hungry)).not.toContain("Your army can explore");

  const fed = realmWithExplorer({ wheat: "100000000000000", fish: "100000000000000" });
  expect(new ArmyActionManager(fed, {} as never, 70).canExplore(350)).toBe(true);
  expect(coachLines(fed)).toContain("Your army can explore");
});
