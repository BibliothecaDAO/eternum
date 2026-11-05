import {
  configManager,
  WorldUpdateListener,
  ruinLimitPerDepth,
  dayOf,
  readExpeditionRules,
} from "@bibliothecadao/eternum";
import { NativeFactStore, type GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { BiomeType, ResourcesIds } from "@bibliothecadao/types";
import { afterEach, expect, it, vi } from "vitest";

import { SITE } from "@/ui/features/frontier/sites/site-fixture";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";

import { rowsOf } from "./lab-chain";
import { readSiteCard } from "@/ui/features/frontier/sites/site-card-plan";

import { ruinFarScenario, ruinFightScenario } from "./ruin-fight-scenario";

afterEach(() => vi.restoreAllMocks());

it.each([ruinFightScenario, ruinFarScenario])(
  "shows a funded discovered chest and per-depth rule before an attack (%#)",
  (makeScenario) => {
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
    const { store, startsAt } = makeScenario();
    const site = store.require("ExpeditionSite", { game_id: 1, entity_id: BigInt(SITE) });
    const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
    const stands = store.entityOccupancy(1, SPIRE_ARMY)!;
    const plan = readSiteCard(
      store,
      site,
      store.require("Structure", { game_id: 1, entity_id: BigInt(SITE) }),
      { col: site.col, row: site.row, alt: site.alt },
      { army, armyTile: stands, biome: BiomeType.Grassland, timestamp: startsAt },
    );
    expect(plan.chest).toEqual({ tier: 1, amount: 100, depth: "Surface", funded: true });
    expect(plan.payout).toEqual({ resourceId: ResourcesIds.Lords, amount: 100, fits: 100 });
    expect(ruinLimitPerDepth(store, 1)).toBe(true);
    expect(site.clear).toBeNull();
    const rules = readExpeditionRules(store, 1)!;
    const day = dayOf(rules, startsAt)!;
    expect(day.index).toBe(Math.floor(site.row / rules.spacing / 4));
    expect(store.require("SiteChest", { game_id: 1, entity_id: BigInt(SITE) }).reservation_day).toBe(BigInt(day.index));
    expect(store.require("LordsBudget", { game_id: 1 }).day).toBe(BigInt(day.index));
    expect(plan.fight).toEqual(
      makeScenario === ruinFightScenario ? { troopsLost: 364, guardLeft: 0 } : { troopsLost: 1_109, guardLeft: 2_412 },
    );
  },
);

it("answers the attack on the ruin as the chain clears it, and its payout story pairs with its winning battle", () => {
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  const scenario = ruinFightScenario();
  expect(ruinLimitPerDepth(scenario.store, 1)).toBe(true);
  const chain = new NativeFactStore();
  chain.applyFacts(rowsOf(scenario.store) as never);
  const army = chain.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
  const staminaBefore = (army.troops.stamina as { Inline: { amount: bigint } }).Inline.amount;
  const chestBefore = chain.require("SiteChest", { game_id: 1, entity_id: BigInt(SITE) });
  const budgetBefore = chain.require("LordsBudget", { game_id: 1 });
  const lordsBefore = chain.require("ResourceBalance", {
    game_id: 1,
    entity_id: 7n,
    resource_type: ResourcesIds.Lords,
  }).balance;
  const paid = vi.fn();
  new WorldUpdateListener({ store: chain } as unknown as GameClientSetup).SitePayouts.onSitePayout(paid);

  const answered = scenario.answer(
    { kind: "BattleGuard", fields: { attacker_id: String(SPIRE_ARMY), defender_id: String(SITE) }, calldata: [] },
    chain,
    scenario.startsAt + 10,
  );
  const isEvent = (model: string) => model === "StoryEvent" || model === "BattleEvent";
  chain.applyFacts(answered.filter((fact) => !isEvent(fact.model)) as never);
  // Herald stamps each event with its place in the transaction, as the lab's Herald does.
  answered
    .filter((fact) => isEvent(fact.model))
    .forEach((event, index) =>
      chain.applyEvent({
        model: event.model,
        key: event.key,
        value: {
          ...(event.value as Record<string, unknown>),
          event_position: { block_number: 2, transaction_hash: "0x1ab0000", transaction_index: 0, event_index: index },
        },
      }),
    );

  expect(answered.some((fact) => fact.model === "SiteChest")).toBe(false);
  expect(chain.require("SiteChest", { game_id: 1, entity_id: BigInt(SITE) })).toEqual(chestBefore);
  expect(chestBefore.amount).toBe(100n);
  expect(chain.require("LordsBudget", { game_id: 1 })).toEqual({
    ...budgetBefore,
    pool_left: budgetBefore.pool_left - 100n,
    rolled_shares: budgetBefore.rolled_shares + 2n,
  });
  expect(
    chain.require("ResourceBalance", { game_id: 1, entity_id: 7n, resource_type: ResourcesIds.Lords }).balance,
  ).toBe(lordsBefore + 100n * 1_000_000_000n);
  expect(
    chain.require("ExpeditionDiscovery", { game_id: 1, structure_id: 7n, epoch: chestBefore.reservation_day })
      .ruin_cleared,
  ).toBe(true);
  const after = chain.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
  expect(after.troops.count).toBe(4_011n * 1_000_000_000n);
  expect((after.troops.stamina as { Inline: { amount: bigint } }).Inline.amount).toBe(staminaBefore - 50n);
  expect(chain.get("Structure", { game_id: 1, entity_id: SITE })).toBeUndefined();
  expect(chain.require("ExpeditionSite", { game_id: 1, entity_id: BigInt(SITE) }).clear?.reward?.amount).toBe(
    100n * 1_000_000_000n,
  );
  expect(paid.mock.calls).toEqual([
    [
      expect.objectContaining({
        siteId: SITE,
        kind: "Ruin",
        reward: { resourceId: ResourcesIds.Lords, amount: 100 },
        troopsLost: 4,
      }),
    ],
  ]);
});

it("stands the far ruin's army out of an attack's reach, and the card forecasts its attack all the same", () => {
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  const { store } = ruinFarScenario();
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
  const stands = store.entityOccupancy(1, SPIRE_ARMY)!;
  const site = store.require("ExpeditionSite", { game_id: 1, entity_id: BigInt(SITE) });
  const plan = readSiteCard(
    store,
    site,
    store.require("Structure", { game_id: 1, entity_id: BigInt(SITE) }),
    { col: site.col, row: site.row, alt: false },
    { army, armyTile: { col: stands.col, row: stands.row, alt: false }, biome: BiomeType.Grassland, timestamp: 0 },
  );
  expect(army.troops.count).toBe(1_626n * 1_000_000_000n);
  expect(plan.guard?.count).toBe(3_000);
  expect(plan.inReach).toBe(false);
  // The attack from beside it: this one costs 1,109 of the 1,626 and leaves the guard 2,412. A second would lose the
  // army; the card speaks only of this one, so it warns of no loss (the owner's Blightglow Rift, 3 November 2026).
  expect(plan.fight).toEqual({ troopsLost: 1_109, guardLeft: 2_412 });
});
