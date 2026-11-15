import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useBlockTimestampStore } from "@/hooks/store/use-block-timestamp-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { deepChargeScenario } from "@/lab/game/charge-scenario";
import { deepScenario } from "@/lab/game/deep-scenario";
import { raceScenario } from "@/lab/game/race-scenario";
import { baneScenario } from "@/lab/game/bane-scenario";
import { configManager, type ResourceManager, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { readArmyMovementReadiness } from "@/ui/features/world/components/armies/army-movement-readiness";
import { readDeepSites } from "@bibliothecadao/eternum/game-client";
import { DeepSiteCard } from "./deep-site-card";
import { resolveExplorerCombatTroops, resolveExplorerTroops, staminaAt } from "@bibliothecadao/eternum/troop-stamina";
import { FrontierArmy } from "../army/frontier-army";
import { useArmyStamina } from "../hud/army-order";

const StaminaReading = () => <output>{useArmyStamina(201, 0)?.held ?? "unknown"}</output>;

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

const draw = (now?: number, scenario = deepScenario()) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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
  const render = (content?: ReactNode) =>
    act(() =>
      root.render(
        <GameProvider
          value={{ store, systemCalls: { interact_site: join, attack_explorer_vs_guard: attack } } as never}
          account={{ address: scenario.player } as never}
        >
          {content ?? (
            <DeepSiteCard
              site={readDeepSites(store, startsAt, 1).find((site) => site.name === "Quarry")!}
              onClose={() => {}}
            />
          )}
        </GameProvider>,
      ),
    );
  render();
  const button = (name: string) =>
    [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === name);
  return { scenario, store, host, join, attack, button, render, unmount: () => act(() => root.unmount()) };
};

describe("the Deep site's live native binding", () => {
  it("reads every site's tick payment and Altar charge from its current rules and facts", () => {
    const scenario = raceScenario();
    scenario.store.applyFacts([
      { model: "BaneRules", key: "0xfee1", value: baneScenario("world").store.require("BaneRules", { game_id: 1 }) },
    ]);
    const hud = draw(undefined, scenario);
    try {
      expect(hud.host.querySelector("[data-deep-pay]")?.textContent).toContain("500");
      const sites = readDeepSites(hud.store, scenario.startsAt, 1);
      for (const site of sites) {
        hud.render(<DeepSiteCard site={site} onClose={() => {}} />);
        const pay = hud.host.querySelector("[data-deep-pay]")!.textContent;
        if (site.name === "Quarry") expect(pay).toContain("500");
        else expect(pay).toContain("5 Glory");
        if (site.name === "Foundation") expect(pay).toContain("+5 height");
        if (site.name === "Altar") expect(pay).toContain("300 of 1,500");
      }
      const rules = hud.store.require("DeepRules", { game_id: 1 });
      act(() =>
        hud.store.applyFacts([
          {
            model: "DeepRules",
            key: hud.store.wireKeyOf("DeepRules", rules)!,
            value: { ...rules, quarry_per_tick: 600n * BigInt(RESOURCE_PRECISION) },
          },
        ]),
      );
      hud.render();
      expect(hud.host.querySelector("[data-deep-pay]")?.textContent).toContain("600");
      expect(hud.host.querySelector("[data-deep-pay]")?.textContent).not.toContain("500");
    } finally {
      hud.unmount();
    }
  });

  it("keeps the joined slot army's refilled stamina and panel after vacating its tile", async () => {
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
      const army = hud.store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
      expect(army.troops.stamina).toEqual({ Slot: 0 });
      const resolved = resolveExplorerTroops(hud.store, army, hud.scenario.startsAt);
      expect(resolved).toBeDefined();
      const rules = hud.store.require("SliceRules", { game_id: 1 });
      expect(staminaAt(resolved!, hud.scenario.startsAt, rules.troop_stamina_config, 60).amount).toBe(60n);
      hud.render(
        <FrontierArmy
          realm={hud.store.require("Structure", { game_id: 1, entity_id: army.owner })}
          choosing={false}
          onClose={() => {}}
        />,
      );
      expect(hud.host.querySelector("[data-stamina-line]")?.textContent).toContain("60/140");
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

it("refreshes stamina from guard membership alone and keeps a missing position unknown", () => {
  const hud = draw();
  try {
    hud.render(<StaminaReading />);
    expect(hud.host.textContent).toBe("60");
    const personalTile = hud.store.entityOccupancy(1, 201)!;
    act(() =>
      hud.store.applyFacts([
        { model: "TileOccupancy", key: hud.store.wireKeyOf("TileOccupancy", personalTile)!, value: null },
      ]),
    );
    expect(hud.host.textContent).toBe("unknown");
    const site = readDeepSites(hud.store, hud.scenario.startsAt, 1).find((site) => site.name === "Quarry")!;
    const membership = { game_id: 1, explorer_id: 201n, site_id: site.id, slot: 1 };
    act(() => hud.store.applyFacts([{ model: "DeepGuard", key: "0xdeed", value: membership }]));
    expect(hud.host.textContent).toBe("60");
    const siteTile = hud.store.entityOccupancy(1, site.id)!;
    const siteKey = hud.store.wireKeyOf("TileOccupancy", siteTile)!;
    act(() => hud.store.applyFacts([{ model: "TileOccupancy", key: siteKey, value: null }]));
    expect(hud.host.textContent).toBe("unknown");
    act(() => hud.store.applyFacts([{ model: "TileOccupancy", key: siteKey, value: siteTile }]));
    expect(hud.host.textContent).toBe("60");
  } finally {
    hud.unmount();
  }
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
          value: { ...game, end_at: BigInt(end), scheduled_end_at: BigInt(end) },
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

it("previews the Deep guard's opening and repeated exchange before sending each attack", async () => {
  const hud = draw(undefined, deepChargeScenario());
  const labels = () =>
    [...hud.host.querySelectorAll('[role="img"][aria-label*="→"]')].map((node) => node.getAttribute("aria-label"));
  try {
    for (const [before, ownLeft, enemyLeft] of [
      [1000, 658, 563],
      [658, 386, 245],
    ]) {
      expect(labels().some((label) => label?.includes(`→ ${ownLeft},`))).toBe(true);
      expect(labels().some((label) => label?.includes(`→ ${enemyLeft},`))).toBe(true);
      expect(hud.button("Attack")?.disabled).toBe(false);
      await act(async () => hud.button("Attack")!.click());
      const site = readDeepSites(hud.store, hud.scenario.startsAt, 1).find(({ name }) => name === "Quarry")!;
      const answer = hud.scenario.answer(
        {
          kind: "BattleGuard",
          fields: { attacker_id: "201", defender_id: String(site.id) },
          calldata: [],
        },
        hud.store,
        hud.scenario.startsAt,
      );
      expect(answer.filter(({ model }) => model === "ArmyCombat")).toHaveLength(before === 1000 ? 1 : 0);
      act(() => hud.store.applyFacts(answer));
      hud.render();
      expect(hud.store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 }).troops.count).toBe(
        BigInt(ownLeft!) * BigInt(RESOURCE_PRECISION),
      );
      expect(hud.store.require("ExplorerTroops", { game_id: 1, explorer_id: 301 }).troops.count).toBe(
        BigInt(enemyLeft!) * BigInt(RESOURCE_PRECISION),
      );
      expect(hud.store.require("ArmyCombat", { game_id: 1, explorer_id: 201 }).last_target).toBe(301n);
    }
    expect(hud.attack).toHaveBeenCalledTimes(2);
  } finally {
    hud.unmount();
  }
});
