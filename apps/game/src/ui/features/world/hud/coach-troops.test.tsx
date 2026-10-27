// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const world = vi.hoisted(() => ({ structures: [] as unknown[], tick: 110 }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentDefaultTick: () => world.tick,
  useNowMs: () => world.tick * 1_000,
}));
vi.mock("@/hooks/use-fact-view", () => ({
  useFactView: (view: unknown) => (view === playerStructuresView ? world.structures : []),
}));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({
    structure: {
      getName: (structure: { entity_id: bigint }) => ({ name: structure.entity_id === 7n ? "Egonal" : "Noyk" }),
    },
  }),
}));
vi.mock("@bibliothecadao/eternum/game-sync", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getActiveGameSyncRuntime: () => null,
}));

import { GameProvider } from "@/hooks/context/game-context";
import { playerStructuresView } from "@/sync/fact-views";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { getBalance, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { useCoachSteps } from "./use-coach-steps";

const PRECISION = BigInt(RESOURCE_PRECISION);

/**
 * Egonal (realm 7) holds no stored Knights but a barracks training one a second since tick 100, within storage; Noyk
 * (holding 8) holds 12 stored Knights and trains none.
 */
const twoHoldings = () => {
  const { store, row } = frontierDay();
  store.applyFacts([
    { model: "ResourceBalance", key: "0x8", value: { game_id: 1, entity_id: 7, resource_type: 26, balance: "0" } },
    {
      model: "ResourceProduction",
      key: "0xa7",
      value: {
        game_id: 1,
        entity_id: 7,
        resource_type: 26,
        building_count: 1,
        production_rate: String(PRECISION),
        output_amount_left: String(1000n * PRECISION),
        last_settled_at: 100,
      },
    },
    { model: "Structure", key: "0xb8", value: { ...row, entity_id: 8 } },
    {
      model: "ResourceWeight",
      key: "0xb9",
      value: { game_id: 1, entity_id: 8, capacity: "100000000000000", weight: "0" },
    },
    {
      model: "ResourceBalance",
      key: "0xba",
      value: { game_id: 1, entity_id: 8, resource_type: 26, balance: String(12n * PRECISION) },
    },
    // Nine Paladins beside Noyk's Knights: an army is of one type and tier, so they do not add to the Knights.
    {
      model: "ResourceBalance",
      key: "0xbc",
      value: { game_id: 1, entity_id: 8, resource_type: ResourcesIds.Paladin, balance: String(9n * PRECISION) },
    },
    {
      model: "ResourceProduction",
      key: "0xbb",
      value: {
        game_id: 1,
        entity_id: 8,
        resource_type: 26,
        building_count: 0,
        production_rate: "0",
        output_amount_left: "0",
        last_settled_at: 100,
      },
    },
  ] as never);
  world.structures = [
    { entityId: 7, structure: row },
    { entityId: 8, structure: { ...row, entity_id: 8n } },
  ];
  return store;
};

afterEach(() => setBlockTimestampSource(null));

it("raises where Military can: troops trained since the last write count, the clock moves them, and the most wins", () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const store = twoHoldings();
  const Probe = () => (
    <p>
      {useCoachSteps()
        .map((step) => (step.kind === "order" ? step.line : step.why))
        .join(" | ")}
    </p>
  );
  const host = document.createElement("div");
  const root = createRoot(host);
  const draw = () =>
    act(() =>
      root.render(
        <GameProvider value={{ store } as never} account={{ address: "0x111" } as never}>
          <Probe />
        </GameProvider>,
      ),
    );
  try {
    world.tick = 110;
    expect(getBalance(7, ResourcesIds.Knight, 110, store).balance).toBe(10 * RESOURCE_PRECISION);
    draw();
    expect(host.textContent).toContain("Noyk: 12 troops ready");
    // Five more seconds of training, and no fact written: Egonal now holds the most.
    world.tick = 115;
    draw();
    expect(host.textContent).toContain("Egonal: 15 troops ready");
  } finally {
    act(() => root.unmount());
  }
});
