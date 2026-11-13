import { nativeReleaseConstants } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { frontierPreset } from "../../../../../config/source/frontier/native";
import { SITE } from "@/ui/features/frontier/sites/site-fixture";
import { dayOf, readExpeditionRules, siteClearXp } from "@bibliothecadao/eternum";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { getNeighborHexes, ResourcesIds, StructureType } from "@bibliothecadao/types";

import { siteAt } from "./after-battle-scenario";
import { type LabFact, type LabScenario, wire } from "./lab-chain";
import { besideOnOpenLand, spireScenario } from "./spire-scenario";

const PRECISION = 1_000_000_000n;
/** The realm the army comes from, and whose player the lab signs as. */
const HOME = 7;
/** The owner's fight on prod (10-25): 4,015 knights against a ruin's 999. */
const ARMY_TROOPS = 4_015n;
const GUARD_TROOPS = 999n;
/** What the clear cost and paid in the owner's screenshot of 10-28: 4 troops lost, an Uncommon chest of 100 LORDS. */
const TROOPS_LOST = 4n;
const CHEST = { tier: 1, lords: 100n };
/** An attack's stamina, as the map's order line names it for this army. */
const ATTACK_STAMINA = 50n;

/**
 * The owner's army beside the ruin before the fight (/lab/game?scenario=ruin-fight): realm 7's 4,015 knights, stamina
 * to attack, beside a ruin guarded by 999, neither on cooldown. The chain answers the attack (BattleGuard) as
 * combat_actions.cairo clears a site: the guard falls, the ruin's structure, guard and tile go, the site keeps its
 * receipt, the army loses 4 troops and the attack's stamina and gains the clear's XP, and the transaction emits the
 * ruin's payout story with its winning battle. Every other command is the spire's.
 */
export const ruinFightScenario = (): LabScenario => ruinScenario(ARMY_TROOPS, GUARD_TROOPS, besideOnOpenLand);

/**
 * The owner's card of 31 October (/lab/game?scenario=ruin-far): 1,626 knights two tiles from a ruin guarded by 3,000,
 * out of an attack's reach. The card forecasts the attack all the same; only Attack waits for the army to arrive.
 */
export const ruinFarScenario = (): LabScenario => ruinScenario(1_626n, 3_000n, twoTilesFrom);

const ruinScenario = (
  armyTroops: bigint,
  guardTroops: bigint,
  place: (store: NativeFactStore, army: { col: number; row: number }) => { col: number; row: number },
): LabScenario => {
  const spire = spireScenario();
  const { store } = spire;
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
  const ruinTile = place(store, store.entityOccupancy(1, SPIRE_ARMY)!);
  const release = store.require("GameRelease", { game_id: 1 });
  store.applyFacts([
    {
      model: "GameRelease",
      key: "0x1ab0",
      value: wire({ ...release, release_id: nativeReleaseConstants.RUIN_DEPTH_LIMIT_RELEASE }),
    },
    {
      model: "ExplorerTroops",
      key: "0x74",
      value: wire({ ...army, troops: { ...army.troops, count: armyTroops * PRECISION } }),
    },
    ...siteAt(store, ruinTile, { ...army.troops, count: guardTroops * PRECISION }, StructureType.Ruin),
    ...fundedRuin(store, ruinTile, spire.startsAt),
  ] as never);
  return {
    ...spire,
    wallet: "0x456",
    answer: (command, chain, now) =>
      command.kind === "BattleGuard" && Number(command.fields.defender_id) === SITE
        ? clearTheRuin(chain, BigInt(command.fields.attacker_id), spire.player, now)
        : spire.answer(command, chain, now),
  };
};

/** Discovery fixes the chest in whole LORDS; funding unlocks enough for this day's attack. */
const fundedRuin = (store: NativeFactStore, tile: { row: number }, now: number): LabFact[] => {
  const rules = readExpeditionRules(store, 1);
  if (!rules) throw new Error("The ruin fixture needs its expedition calendar");
  const day = dayOf(rules, now);
  if (!day || day.index !== Math.floor(tile.row / rules.spacing / 4))
    throw new Error("The ruin fixture must stand on today's map");
  const elapsed = BigInt(day.end - rules.startMainAt);
  const duration = BigInt(rules.endAt - rules.startMainAt);
  const pool = (CHEST.lords * duration + elapsed - 1n) / elapsed;
  const budget = store.require("LordsBudget", { game_id: 1 });
  const held = [...store.entries("ResourceBalance")].find(
    ([, row]) => row.entity_id === BigInt(HOME) && row.resource_type === ResourcesIds.Lords,
  );
  const chests = frontierPreset.chests;
  return [
    // A LORDS pool is published only in a game whose preset carries chest rules: its ruins pay chests, not relics.
    {
      model: "ChestRules",
      key: "0x1ab9b",
      value: wire({
        game_id: 1,
        price_ceiling: BigInt(chests.priceCeiling),
        shares: chests.shares,
        claim_window_seconds: chests.claimWindowSeconds,
        pool_bps: chests.poolBps,
        top_n: chests.topN,
      } satisfies NativeRows["ChestRules"]),
    },
    {
      model: "SiteChest",
      key: "0x1ab9c",
      value: wire({
        game_id: 1,
        entity_id: BigInt(SITE),
        tier: CHEST.tier,
        amount: CHEST.lords,
        reservation_day: BigInt(day.index),
      } satisfies NativeRows["SiteChest"]),
    },
    {
      model: "LordsBudget",
      key: "0x101",
      value: wire({
        game_id: 1,
        pool,
        pool_left: pool,
        open: 0n,
        day: BigInt(day.index),
        price: budget.price,
        rolled_shares: 0n,
        yesterday_shares: 0n,
        yesterday_ticks: 0n,
      } satisfies NativeRows["LordsBudget"]),
    },
    ...(held
      ? []
      : [
          {
            model: "ResourceBalance",
            key: "0x1ab9e",
            value: wire({
              game_id: 1,
              entity_id: BigInt(HOME),
              resource_type: ResourcesIds.Lords,
              balance: 0n,
            } satisfies NativeRows["ResourceBalance"]),
          },
        ]),
  ];
};

/** An open, revealed tile two steps from the army: beside a tile beside it, and not beside the army itself. */
const twoTilesFrom = (store: NativeFactStore, army: { col: number; row: number }) => {
  const near = new Set([army, ...getNeighborHexes(army.col, army.row)].map((hex) => `${hex.col},${hex.row}`));
  const taken = new Set([...store.entries("TileOccupancy")].map(([, row]) => `${row.col},${row.row}`));
  const tile = getNeighborHexes(army.col, army.row)
    .flatMap((step) => getNeighborHexes(step.col, step.row))
    .find(
      (hex) =>
        !near.has(`${hex.col},${hex.row}`) &&
        !taken.has(`${hex.col},${hex.row}`) &&
        store.get("TileOpt", { game_id: 1, alt: false, col: hex.col, row: hex.row }),
    );
  if (!tile) throw new Error("The lab finds no open tile two steps from the spire's army");
  return { col: tile.col, row: tile.row };
};

const clearTheRuin = (chain: NativeFactStore, explorerId: bigint, player: string, now: number): LabFact[] => {
  const army = chain.require("ExplorerTroops", { game_id: 1, explorer_id: explorerId });
  const guard = chain.require("Guard", { game_id: 1, structure_id: BigInt(SITE), slot: 0 });
  const site = chain.require("ExpeditionSite", { game_id: 1, entity_id: BigInt(SITE) });
  const progress = chain.require("ArmyProgress", { game_id: 1, explorer_id: explorerId });
  const chest = chain.require("SiteChest", { game_id: 1, entity_id: BigInt(SITE) });
  const budget = chain.require("LordsBudget", { game_id: 1 });
  const held = chain.require("ResourceBalance", {
    game_id: 1,
    entity_id: BigInt(HOME),
    resource_type: ResourcesIds.Lords,
  });
  const discovery = chain.get("ExpeditionDiscovery", {
    game_id: 1,
    structure_id: BigInt(HOME),
    epoch: chest.reservation_day,
  });
  const stamina = army.troops.stamina as { Inline: { amount: bigint } };
  const before = army.troops.count;
  const after = before - TROOPS_LOST * PRECISION;
  const reward = { resource_type: ResourcesIds.Lords, amount: chest.amount * PRECISION };
  const side = (owner: string, troops: typeof army.troops, from: bigint, to: bigint) => ({
    player: owner,
    category: troops.category,
    tier: troops.tier,
    before: from,
    after: to,
    roll: 50,
  });
  return [
    {
      model: "Structure",
      key: chain.wireKeyOf("Structure", { game_id: 1, entity_id: BigInt(SITE) })!,
      value: null,
    },
    {
      model: "Guard",
      key: chain.wireKeyOf("Guard", { game_id: 1, structure_id: BigInt(SITE), slot: 0 })!,
      value: null,
    },
    {
      model: "TileOccupancy",
      key: chain.wireKeyOf("TileOccupancy", chain.entityOccupancy(1, SITE)!)!,
      value: null,
    },
    {
      model: "ExpeditionSite",
      key: chain.wireKeyOf("ExpeditionSite", { game_id: 1, entity_id: BigInt(SITE) })!,
      value: wire({ ...site, clear: { explorer_id: explorerId, home_id: HOME, reward } }),
    },
    {
      model: "LordsBudget",
      key: chain.wireKeyOf("LordsBudget", { game_id: 1 })!,
      value: wire({
        ...budget,
        pool_left: budget.pool_left - chest.amount,
        rolled_shares: budget.rolled_shares + chest.amount / budget.price,
      }),
    },
    {
      model: "ResourceBalance",
      key: chain.wireKeyOf("ResourceBalance", {
        game_id: 1,
        entity_id: BigInt(HOME),
        resource_type: ResourcesIds.Lords,
      })!,
      value: wire({ ...held, balance: held.balance + reward.amount }),
    },
    {
      model: "ExpeditionDiscovery",
      key:
        chain.wireKeyOf("ExpeditionDiscovery", {
          game_id: 1,
          structure_id: BigInt(HOME),
          epoch: chest.reservation_day,
        }) ?? "0x1ab9f",
      value: wire({
        game_id: 1,
        structure_id: BigInt(HOME),
        epoch: chest.reservation_day,
        empty_reveals: discovery?.empty_reveals ?? 0,
        ruin_cleared: true,
      } satisfies NativeRows["ExpeditionDiscovery"]),
    },
    {
      model: "ExplorerTroops",
      key: chain.wireKeyOf("ExplorerTroops", { game_id: 1, explorer_id: explorerId })!,
      value: wire({
        ...army,
        troops: {
          ...army.troops,
          count: after,
          stamina: { Inline: { amount: stamina.Inline.amount - ATTACK_STAMINA, settled_at: now, remainder: 0 } },
        },
      }),
    },
    {
      model: "ArmyProgress",
      key: chain.wireKeyOf("ArmyProgress", { game_id: 1, explorer_id: explorerId })!,
      value: wire({ ...progress, xp: progress.xp + siteClearXp(chain, site) }),
    },
    {
      model: "StoryEvent",
      key: "payout",
      value: wire({
        version: 1,
        game_id: 1,
        owner: player,
        entity_id: HOME,
        tx_hash: "0x0",
        story: {
          SitePayout: {
            structure_id: HOME,
            explorer_id: explorerId,
            site_id: SITE,
            category: StructureType.Ruin,
            reward,
          },
        },
        timestamp: now,
      }),
    },
    {
      model: "BattleEvent",
      key: "battle",
      value: wire({
        version: 1,
        game_id: 1,
        attacker_id: explorerId,
        defender_id: SITE,
        attacker_owner: HOME,
        defender_owner: 0,
        winner_id: HOME,
        coord: { x: site.col, y: site.row },
        max_reward: [],
        attacker: side(player, army.troops, before, after),
        defender: side("0x0", guard.troops, guard.troops.count, 0n),
        timestamp: now,
      }),
    },
  ];
};
