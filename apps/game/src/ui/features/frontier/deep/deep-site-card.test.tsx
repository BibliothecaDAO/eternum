import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useBlockTimestampStore } from "@/hooks/store/use-block-timestamp-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { wire } from "@/lab/game/lab-chain";
import { deepBattleTargetScenario } from "@/lab/game/battle-target-scenario";
import { deepScenario } from "@/lab/game/deep-scenario";
import { raceScenario } from "@/lab/game/race-scenario";
import { baneScenario } from "@/lab/game/bane-scenario";
import { configManager, type ResourceManager, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { readArmyMovementReadiness } from "@/ui/features/world/components/armies/army-movement-readiness";
import { nativeOathConstants as oaths, nativeRuleConstants, readDeepSites } from "@bibliothecadao/eternum/game-client";
import { DEEP_WORDS } from "@/ui/design-system/kit/words";
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

const draw = (now?: number, scenario = deepScenario()) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { store } = scenario;
  const startsAt = now ?? scenario.startsAt;
  setBlockTimestampSource(() => startsAt);
  useBlockTimestampStore.setState({ currentBlockTimestamp: startsAt, currentDefaultTick: startsAt });
  useAccountStore.setState({ account: { address: scenario.player } as never });
  useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: null });
  const attack = vi.fn().mockResolvedValue({ transaction_hash: "0x1" });
  const host = document.createElement("div");
  const root = createRoot(host);
  const render = (content?: ReactNode) =>
    act(() =>
      root.render(
        <GameProvider
          value={{ store, systemCalls: { attack_explorer_vs_guard: attack } } as never}
          account={{ address: scenario.player } as never}
        >
          {content ?? (
            <DeepSiteCard
              site={readDeepSites(store, startsAt, 1).find((site) => site.kind === nativeRuleConstants.DEEP_MINE)!}
              onClose={() => {}}
            />
          )}
        </GameProvider>,
      ),
    );
  render();
  const button = (name: string) =>
    [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.startsWith(name));
  return { scenario, store, host, attack, button, render, unmount: () => act(() => root.unmount()) };
};

describe("the Deep site's live native binding", () => {
  it("reads every site's tick payment and Altar charge from its current rules and facts", () => {
    const scenario = raceScenario();
    scenario.store.applyFacts([
      { model: "BaneRules", key: "0xfee1", value: baneScenario("world").store.require("BaneRules", { game_id: 1 }) },
    ]);
    const hud = draw(undefined, scenario);
    try {
      const rules = hud.store.require("DeepRules", { game_id: 1 });
      const perTick = (amount: bigint) => Number(amount / BigInt(RESOURCE_PRECISION));
      const rate = (kind: string) => hud.host.querySelector(`[data-rate='${kind}'] b`)?.textContent;
      const sites = readDeepSites(hud.store, scenario.startsAt, 1);
      const ladder = [rules.building_pay.alone, rules.building_pay.pair, rules.building_pay.crowd];
      for (const site of sites) {
        hud.render(<DeepSiteCard site={site} onClose={() => {}} />);
        if (!site.open) {
          expect(hud.host.querySelector("[data-deep-pay]")).toBeNull();
          expect(hud.host.querySelector("[data-deep-opening]")?.textContent).toContain(
            `${site.entered} / ${site.opensAt}`,
          );
          continue;
        }
        expect(hud.host.querySelector("[data-deep-pay]")?.textContent).toContain("/ 2m");
        const openOfKind = sites.filter((other) => other.kind === site.kind && other.open).length;
        const building = ladder[Math.min(openOfKind, ladder.length) - 1];
        if (site.kind === nativeRuleConstants.DEEP_MINE) expect(rate("labor")).toBe(`+${perTick(rules.mine_per_tick)}`);
        else if (site.kind === nativeRuleConstants.DEEP_CORE)
          expect(rate("essence")).toBe(`+${perTick(rules.core_per_tick)}`);
        else expect(rate("glory")).toBe(`+${building}`);
        if (site.kind === nativeRuleConstants.DEEP_FOUNDATION) expect(rate("height")).toBe(`+${building}`);
        if (site.kind === nativeRuleConstants.DEEP_ALTAR)
          expect(hud.host.querySelector("[data-rate='bar']")?.getAttribute("data-tip")).toBe("300 of 1,500");
      }
      hud.render(
        <DeepSiteCard
          site={sites.find((site) => site.kind === nativeRuleConstants.DEEP_MINE && site.open)!}
          onClose={() => {}}
        />,
      );
      act(() =>
        hud.store.applyFacts([
          {
            model: "DeepRules",
            key: hud.store.wireKeyOf("DeepRules", rules)!,
            value: { ...rules, mine_per_tick: 600n * BigInt(RESOURCE_PRECISION) },
          },
        ]),
      );
      hud.render(
        <DeepSiteCard
          site={
            readDeepSites(hud.store, scenario.startsAt, 1).find(
              (site) => site.kind === nativeRuleConstants.DEEP_MINE && site.open,
            )!
          }
          onClose={() => {}}
        />,
      );
      expect(hud.host.querySelector("[data-rate='labor'] b")?.textContent).toBe("+600");
    } finally {
      hud.unmount();
    }
  });

  it("lists on a locked site what its open rates pay, the Bane bar only where the game has banes", () => {
    const scenario = raceScenario();
    const hud = draw(undefined, scenario);
    try {
      const sites = readDeepSites(hud.store, scenario.startsAt, 1);
      const kinds = (site: (typeof sites)[number]) => {
        hud.render(<DeepSiteCard site={{ ...site, open: false }} onClose={() => {}} />);
        return hud.host.querySelector("[data-deep-kinds]")?.textContent ?? "";
      };
      const altar = sites.find((site) => site.kind === nativeRuleConstants.DEEP_ALTAR)!;
      expect(kinds(altar)).not.toContain(DEEP_WORDS.kinds.bar);
      act(() =>
        hud.store.applyFacts([
          {
            model: "BaneRules",
            key: "0xfee1",
            value: baneScenario("world").store.require("BaneRules", { game_id: 1 }),
          },
        ]),
      );
      expect(kinds(altar)).toContain(DEEP_WORDS.kinds.bar);
      for (const site of sites) {
        hud.render(<DeepSiteCard site={site} onClose={() => {}} />);
        const paid = [...hud.host.querySelectorAll("[data-deep-pay] [data-rate]")]
          .map((rate) => rate.getAttribute("data-rate"))
          .filter((rate) => rate !== "drain");
        const listed = kinds(site);
        for (const rate of paid) expect(listed).toContain(DEEP_WORDS.kinds[rate as keyof typeof DEEP_WORDS.kinds]);
      }
    } finally {
      hud.unmount();
    }
  });

  it("offers no order on a site its own Aspect holds, and shows the garrison in its slots", () => {
    const hud = draw();
    try {
      expect(hud.host.querySelector("[data-deep-tag]")?.textContent).toBe("Held · Prowess");
      expect(hud.host.textContent).toContain(DEEP_WORDS.guarding);
      expect(hud.button("Attack")).toBeUndefined();
      expect(hud.host.querySelectorAll('[data-deep-slot="filled"]')).toHaveLength(1);
      expect(hud.host.querySelectorAll("[data-deep-slot]")).toHaveLength(4);
    } finally {
      hud.unmount();
    }
  });

  it("sends a rival slot through the existing guard attack provider", async () => {
    const hud = draw();
    try {
      const held = readDeepSites(hud.store, hud.scenario.startsAt, 1).find(
        (site) => site.kind === nativeRuleConstants.DEEP_MINE,
      )!;
      const row = hud.store.require("DeepSite", { game_id: 1, entity_id: held.id });
      act(() =>
        hud.store.applyFacts([
          { model: "DeepSite", key: hud.store.wireKeyOf("DeepSite", row)!, value: { ...row, aspect: 2 } },
        ]),
      );
      hud.render();
      expect(hud.button("Attack")?.disabled).toBe(false);
      await act(async () => hud.button("Attack")!.click());
      const mine = readDeepSites(hud.store, hud.scenario.startsAt, 1).find(
        (site) => site.kind === nativeRuleConstants.DEEP_MINE,
      )!;
      expect(hud.attack).toHaveBeenCalledTimes(1);
      expect(hud.attack).toHaveBeenCalledWith(
        expect.objectContaining({ explorer_id: 201, structure_id: Number(mine.id) }),
      );
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
          value: { ...game, end_at: BigInt(end), scheduled_end_at: BigInt(end) },
        },
      ]),
    );
    hud.render();
    const tips = [...hud.host.querySelectorAll('[data-deep-slot="filled"]')].map(
      (node) => node.getAttribute("data-tip") ?? "",
    );
    expect(tips.join(" ")).toContain("5 ticks left");
    expect(tips.join(" ")).not.toContain("6 ticks left");
  } finally {
    hud.unmount();
  }
});

it("shows the selected army's own Deep poison, Vitriol included, on a site's drain cell", () => {
  const hud = draw();
  try {
    const mine = () =>
      readDeepSites(hud.store, hud.scenario.startsAt, 1).find(
        (site) => site.kind === nativeRuleConstants.DEEP_MINE && site.open,
      )!;
    const drain = () => hud.host.querySelector("[data-rate='drain'] b")?.textContent;
    const base = hud.store.require("DeepRules", { game_id: 1 }).loss_per_tick / BigInt(RESOURCE_PRECISION);
    hud.render(<DeepSiteCard site={mine()} onClose={() => {}} />);
    expect(drain()).toBe(`−${base.toLocaleString("en-US")}`);
    const key = { game_id: 1, explorer_id: 201 };
    const progress = hud.store.require("ArmyProgress", key);
    act(() =>
      hud.store.applyFacts([
        {
          model: "ArmyProgress",
          key: hud.store.wireKeyOf("ArmyProgress", key)!,
          value: { ...progress, oaths: 1 << (oaths.VITRIOL - 1) },
        },
      ]),
    );
    hud.render(<DeepSiteCard site={mine()} onClose={() => {}} />);
    expect(drain()).toBe(`−${oaths.VITRIOL_LOSS_PER_TICK.toLocaleString("en-US")}`);
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

it("previews the Deep garrison's opening and repeated exchange before sending each attack", async () => {
  const hud = draw(undefined, deepBattleTargetScenario());
  const labels = () =>
    [...hud.host.querySelectorAll("[data-fight-side]")].map((node) => node.getAttribute("aria-label"));
  try {
    for (const [before, ownLeft, enemyLeft] of [
      [1000, 670, 754],
      [670, 400, 578],
    ]) {
      expect(labels().some((label) => label?.includes(`→ ${ownLeft},`))).toBe(true);
      expect(labels().some((label) => label?.includes(`→ ${enemyLeft},`))).toBe(true);
      expect(hud.button("Attack")?.disabled).toBe(false);
      await act(async () => hud.button("Attack")!.click());
      const site = readDeepSites(hud.store, hud.scenario.startsAt, 1).find(
        ({ kind }) => kind === nativeRuleConstants.DEEP_MINE,
      )!;
      const answer = hud.scenario.answer(
        {
          kind: "BattleGuard",
          fields: { attacker_id: "201", defender_id: String(site.id) },
          span: [],
        },
        hud.store,
        hud.scenario.startsAt,
      );
      expect(answer.filter(({ model }) => model === "ArmyCombat")).toHaveLength(before === 1000 ? 1 : 0);
      act(() =>
        hud.store.applyFacts(answer.map((fact) => ({ ...fact, value: fact.value === null ? null : wire(fact.value) }))),
      );
      hud.render();
      expect(hud.store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 }).troops.count).toBe(
        BigInt(ownLeft!) * BigInt(RESOURCE_PRECISION),
      );
      expect(hud.store.require("Guard", { game_id: 1, structure_id: site.id, slot: 1 }).troops.count).toBe(
        BigInt(enemyLeft!) * BigInt(RESOURCE_PRECISION),
      );
      expect(hud.store.require("ArmyCombat", { game_id: 1, explorer_id: 201 }).last_target).toBe(site.id);
    }
    expect(hud.attack).toHaveBeenCalledTimes(2);
  } finally {
    hud.unmount();
  }
});

it("shows each garrison's share of the next tick from the troops it keeps after the tick's loss", () => {
  const scenario = deepScenario();
  const { store } = scenario;
  const loss = store.require("DeepRules", { game_id: 1 }).loss_per_tick;
  const quarry = readDeepSites(store, scenario.startsAt, 1).find(
    (site) => site.kind === nativeRuleConstants.DEEP_MINE,
  )!;
  const held = store.require("Guard", { game_id: 1, structure_id: quarry.id, slot: 1 });
  const home = store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 }).owner;
  store.applyFacts([
    {
      model: "Guard",
      key: store.wireKeyOf("Guard", held)!,
      value: wire({ ...held, troops: { ...held.troops, count: 4n * loss } }),
    },
    {
      model: "Guard",
      key: "0xdeee",
      value: wire({ ...held, slot: 2, troops: { ...held.troops, count: 2n * loss } }),
    },
    {
      model: "GarrisonSlot",
      key: "0xdeed",
      value: wire({ game_id: 1, structure_id: quarry.id, slot: 2, home }),
    },
  ] as never);
  const hud = draw(undefined, scenario);
  try {
    const tips = [...hud.host.querySelectorAll('[data-deep-slot="filled"]')].map(
      (node) => node.getAttribute("data-tip") ?? "",
    );
    expect(tips.join(" ")).toContain(DEEP_WORDS.share(75));
    expect(tips.join(" ")).toContain(DEEP_WORDS.share(25));
  } finally {
    hud.unmount();
  }
});
