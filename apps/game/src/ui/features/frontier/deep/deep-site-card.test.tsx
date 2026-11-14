import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useBlockTimestampStore } from "@/hooks/store/use-block-timestamp-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { deepScenario } from "@/lab/game/deep-scenario";
import { configManager, type ResourceManager, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { readArmyMovementReadiness } from "@/ui/features/world/components/armies/army-movement-readiness";
import { readDeepSites } from "@bibliothecadao/eternum/game-client";
import { DeepSiteCard } from "./deep-site-card";
import { resolveExplorerCombatTroops } from "@bibliothecadao/eternum/troop-stamina";

vi.mock("@/sync/active-game-client", async (original) => ({
  ...(await original<typeof import("@/sync/active-game-client")>()),
  requireActiveGameClient: () => ({
    waitForAction: () => Promise.resolve({ hash: "0x1", block: 9, status: "SUCCEEDED" }),
  }),
}));

afterEach(() => {
  useUIStore.getState().selectOnMap(null);
  useAccountStore.setState({ account: null });
  setBlockTimestampSource(null);
  vi.restoreAllMocks();
});

const draw = (now?: number) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const scenario = deepScenario();
  const { store } = scenario;
  const startsAt = now ?? scenario.startsAt;
  setBlockTimestampSource(() => startsAt);
  useBlockTimestampStore.setState({ currentBlockTimestamp: startsAt, currentDefaultTick: startsAt });
  useAccountStore.setState({ account: { address: scenario.player } as never });
  useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: null });
  const join = vi.fn().mockResolvedValue({ transaction_hash: "0x1" });
  const attack = vi.fn().mockResolvedValue({ transaction_hash: "0x1" });
  const host = document.createElement("div");
  const root = createRoot(host);
  const render = () =>
    act(() =>
      root.render(
        <GameProvider
          value={{ store, systemCalls: { interact_site: join, attack_explorer_vs_guard: attack } } as never}
          account={{ address: scenario.player } as never}
        >
          <DeepSiteCard
            site={readDeepSites(store, startsAt, 1).find((site) => site.name === "Quarry")!}
            onClose={() => {}}
          />
        </GameProvider>,
      ),
    );
  render();
  const button = (name: string) =>
    [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === name);
  return { scenario, store, host, join, attack, button, render, unmount: () => act(() => root.unmount()) };
};

describe("the Deep site's live native binding", () => {
  it("joins an ally through InteractSite and reads the resulting guard membership", async () => {
    const hud = draw();
    try {
      expect(hud.host.textContent).toContain("Held by Might");
      expect(hud.button("Join")?.disabled).toBe(false);
      await act(async () => hud.button("Join")!.click());
      const site = readDeepSites(hud.store, hud.scenario.startsAt, 1).find((site) => site.name === "Quarry")!;
      expect(hud.join).toHaveBeenCalledTimes(1);
      expect(hud.join).toHaveBeenCalledWith(expect.objectContaining({ explorer_id: 201, coord: site.position }));
      expect(hud.attack).not.toHaveBeenCalled();
      const answer = hud.scenario.answer(
        {
          kind: "InteractSite",
          fields: {},
          calldata: ["1", "3", "0", "5", "0", "201", "0", String(site.position.x), String(site.position.y)],
        },
        hud.store,
        hud.scenario.startsAt,
      );
      act(() => hud.store.applyFacts(answer as never));
      hud.render();
      expect(hud.store.entityOccupancy(1, 201)).toBeUndefined();
      expect(hud.store.require("DeepGuard", { game_id: 1, explorer_id: 201 }).slot).toBe(1);
      expect(hud.button("Join")).toBeUndefined();
      expect(hud.host.textContent).toContain("Already guarding");
      expect(hud.host.querySelectorAll("[data-deep-slots] .ui-row")).toHaveLength(4);
    } finally {
      hud.unmount();
    }
  });

  it("sends a rival slot through the existing guard attack provider", async () => {
    const hud = draw();
    try {
      act(() =>
        hud.store.applyFacts([{ model: "HomeAspect", key: "0xdee2", value: { game_id: 1, home: "9", aspect: 2 } }]),
      );
      hud.render();
      expect(hud.button("Join")).toBeUndefined();
      expect(hud.button("Attack")?.disabled).toBe(false);
      await act(async () => hud.button("Attack")!.click());
      const quarry = readDeepSites(hud.store, hud.scenario.startsAt, 1).find((site) => site.name === "Quarry")!;
      expect(hud.attack).toHaveBeenCalledTimes(1);
      expect(hud.attack).toHaveBeenCalledWith(
        expect.objectContaining({ explorer_id: 201, structure_id: Number(quarry.id) }),
      );
      expect(hud.join).not.toHaveBeenCalled();
    } finally {
      hud.unmount();
    }
  });
});

it("counts only actual army-tick boundaries before a day ending between ticks", () => {
  const hud = draw(361);
  try {
    const game = hud.store.require("GameRegistry", { game_id: 1 });
    const interval = Number(hud.store.require("SliceRules", { game_id: 1 }).tick_config.armies_tick_in_seconds);
    const end = (Math.floor(361 / interval) + 5) * interval + Math.floor(interval / 2);
    act(() =>
      hud.store.applyFacts([
        {
          model: "GameRegistry",
          key: hud.store.wireKeyOf("GameRegistry", { game_id: 1 })!,
          value: { ...game, end_at: BigInt(end) },
        },
      ]),
    );
    hud.render();
    expect(hud.host.textContent).toContain("5 ticks left");
    expect(hud.host.textContent).not.toContain("6 ticks left");
  } finally {
    hud.unmount();
  }
});

it("forecasts Deep troop loss at the execution second rather than the displayed clock", () => {
  const { store, startsAt } = deepScenario();
  setBlockTimestampSource(() => startsAt);
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
  const interval = Number(store.require("SliceRules", { game_id: 1 }).tick_config.armies_tick_in_seconds);
  const boundary = (Math.floor(startsAt / interval) + 1) * interval;
  const loss = store.require("DeepRules", { game_id: 1 }).loss_per_tick;
  expect(resolveExplorerCombatTroops(store, army, startsAt)?.count).toBe(army.troops.count);
  expect(resolveExplorerCombatTroops(store, army, boundary)?.count).toBe(army.troops.count - loss);
  expect(resolveExplorerCombatTroops(store, army, boundary + interval)?.count).toBe(army.troops.count - 2n * loss);
  expect(store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 }).troops.count).toBe(army.troops.count);
});

it("prices Deep movement from the troops left at the requested second", () => {
  const { store, startsAt } = deepScenario();
  setBlockTimestampSource(() => startsAt);
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
  const interval = Number(store.require("SliceRules", { game_id: 1 }).tick_config.armies_tick_in_seconds);
  const boundary = (Math.floor(startsAt / interval) + 1) * interval;
  const loss = store.require("DeepRules", { game_id: 1 }).loss_per_tick;
  const structureResources = { balanceWithProduction: () => ({ balance: 0 }) } as unknown as ResourceManager;
  const read = (currentDefaultTick: number) =>
    readArmyMovementReadiness({ army, store, structureResources, currentDefaultTick });
  const perTroop = configManager.getTravelFoodCostConfig(ResourcesIds.Knight).travelWheatBurnAmount;
  expect(perTroop).toBeGreaterThan(0);
  expect(read(startsAt)?.foodBlock?.perStep.wheatPayAmount).toBe(
    (Number(army.troops.count) / RESOURCE_PRECISION) * perTroop,
  );
  expect(read(boundary)?.foodBlock?.perStep.wheatPayAmount).toBe(
    (Number(army.troops.count - loss) / RESOURCE_PRECISION) * perTroop,
  );
  expect(read(boundary + interval)?.foodBlock?.perStep.wheatPayAmount).toBe(
    (Number(army.troops.count - 2n * loss) / RESOURCE_PRECISION) * perTroop,
  );
});
