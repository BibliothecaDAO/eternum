import { SITE } from "@/ui/features/frontier/sites/site-fixture";
import { siteClearXp } from "@/ui/features/frontier/sites/site-card-plan";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds, StructureType } from "@bibliothecadao/types";

import { ruinAt } from "./after-battle-scenario";
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
export const ruinFightScenario = (): LabScenario => {
  const spire = spireScenario();
  const { store } = spire;
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
  const ruinTile = besideOnOpenLand(store, store.entityOccupancy(1, SPIRE_ARMY)!);
  store.applyFacts([
    {
      model: "ExplorerTroops",
      key: "0x74",
      value: wire({ ...army, troops: { ...army.troops, count: ARMY_TROOPS * PRECISION } }),
    },
    ...ruinAt(store, ruinTile, { ...army.troops, count: GUARD_TROOPS * PRECISION }),
  ] as never);
  return {
    ...spire,
    answer: (command, chain, now) =>
      command.kind === "BattleGuard" && Number(command.fields.defender_id) === SITE
        ? clearTheRuin(chain, BigInt(command.fields.attacker_id), spire.player, now)
        : spire.answer(command, chain, now),
  };
};

/** The key the chain holds a row under, found by the row. */
const keyOf = <Row>(rows: Iterable<readonly [string, Row]>, matches: (row: Row) => boolean): string => {
  for (const [key, row] of rows) if (matches(row)) return key;
  throw new Error("The lab's chain holds no row for the ruin's fight");
};

const clearTheRuin = (chain: NativeFactStore, explorerId: bigint, player: string, now: number): LabFact[] => {
  const army = chain.require("ExplorerTroops", { game_id: 1, explorer_id: explorerId });
  const guard = chain.require("Guard", { game_id: 1, structure_id: BigInt(SITE), slot: 0 });
  const site = chain.require("ExpeditionSite", { game_id: 1, entity_id: BigInt(SITE) });
  const progress = chain.require("ArmyProgress", { game_id: 1, explorer_id: explorerId });
  const stamina = army.troops.stamina as { Inline: { amount: bigint } };
  const before = army.troops.count;
  const after = before - TROOPS_LOST * PRECISION;
  const reward = { resource_type: ResourcesIds.Lords, amount: CHEST.lords * PRECISION };
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
      key: keyOf(chain.entries("Structure"), (row) => Number(row.entity_id) === SITE),
      value: null,
    },
    { model: "Guard", key: keyOf(chain.entries("Guard"), (row) => Number(row.structure_id) === SITE), value: null },
    {
      model: "TileOccupancy",
      key: keyOf(chain.entries("TileOccupancy"), (row) => Number(row.entity_id) === SITE),
      value: null,
    },
    {
      model: "ExpeditionSite",
      key: keyOf(chain.entries("ExpeditionSite"), (row) => Number(row.entity_id) === SITE),
      value: wire({ ...site, clear: { explorer_id: explorerId, home_id: HOME, reward } }),
    },
    {
      model: "SiteChest",
      key: "0x1ab9c",
      value: wire({ game_id: 1, entity_id: SITE, tier: CHEST.tier, amount: reward.amount, reservation_day: 1 }),
    },
    {
      model: "ExplorerTroops",
      key: keyOf(chain.entries("ExplorerTroops"), (row) => row.explorer_id === explorerId),
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
      key: keyOf(chain.entries("ArmyProgress"), (row) => row.explorer_id === explorerId),
      value: wire({ ...progress, xp: progress.xp + siteClearXp(site) }),
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
