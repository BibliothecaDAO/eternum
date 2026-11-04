import { configManager, logisticsStamina, lowestFittingPoint, skillPointRefill } from "@bibliothecadao/eternum";
import { resolveExplorerTroops, staminaAt } from "@bibliothecadao/eternum/troop-stamina";
import { RESOURCE_PRECISION, ResourcesIds, TickIds, TileOccupier } from "@bibliothecadao/types";

import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";

import { actionsScenario } from "./actions-scenario";
import { chainOf, wire, type LabCommand, type LabFact, type LabScenario } from "./lab-chain";
import { siteAt } from "./sites-scenario";
import { balancesPaid, besideOnOpenLand } from "./spire-scenario";

/** The realm's LORDS: enough to refill the army from nothing. */
const LORDS_HELD = 500n * BigInt(RESOURCE_PRECISION);
/** The army's stamina after a hard day: well short of its bar, so a refill has points to buy. */
const STAMINA_LEFT = 40n;
/** XP enough for an uncommon tier in any attribute. */
const XP_HELD = 500;
/** The chest beside the army, and the LORDS it holds for the realm that opens it. */
const CHEST = 990;
const CHEST_LORDS = 50n * BigInt(RESOURCE_PRECISION);

/**
 * The actions game after a day out (/lab/game?scenario=upkeep): the realm holds LORDS, its army is short of stamina and
 * has XP to spend. The chain answers RefillStamina (relics.cairo's refill_stamina: the bar to its maximum, one LORDS a
 * point), SpendSkillPoint (progression.cairo's spend_skill_point: one fitting point spent, the attribute a tier up, and the tier's stamina)
 * DestroyBuilding (the building off its plot; the lab keeps no refund) and OpenRelicChest (relics.cairo's
 * open_relic_chest on Frontier: the chest consumed from its tile, its LORDS paid to the army's realm) and WithdrawLords
 * (relics.cairo's withdraw_lords: the realm's LORDS debited, the withdrawal recorded for the ledger to pay) as the
 * contract does. A chest stands beside the army, and the player has a payout wallet linked.
 */
export const upkeepScenario = (): LabScenario => {
  const actions = actionsScenario();
  // Its rows rewritten under the keys the chain serves them by, so a fact below changes the row it names.
  const store = chainOf(actions);
  store.applyFacts([lordsHeld(store), ...staminaSpent(store, actions.startsAt), progressHeld(store)] as never);
  store.applyFacts(chestBeside(store) as never);
  const answers: Record<string, (command: LabCommand, chain: NativeFactStore, now: number) => LabFact[]> = {
    RefillStamina: refill,
    SpendSkillPoint: spendPoint,
    DestroyBuilding: demolish,
    OpenRelicChest: openChest,
    WithdrawLords: withdrawLords,
  };
  return {
    ...actions,
    store,
    // A payout wallet linked, which Withdraw pays to.
    wallet: "0x456",
    answer: (command, chain, now) => (answers[command.kind] ?? actions.answer)(command, chain, now),
  };
};

const lordsHeld = (store: NativeFactStore): LabFact => {
  const held = [...store.entries("ResourceBalance")].find(
    ([, row]) => row.entity_id === 7n && row.resource_type === ResourcesIds.Lords,
  );
  return {
    model: "ResourceBalance",
    key: held?.[0] ?? "0x1b40",
    value: { game_id: 1, entity_id: 7, resource_type: ResourcesIds.Lords, balance: String(LORDS_HELD) },
  };
};

const armyRow = (chain: NativeFactStore, explorerId: bigint) =>
  [...chain.entries("ExplorerTroops")].find(([, row]) => row.explorer_id === explorerId)!;

/**
 * The army after a hard day, its bar in its home's army slot as the contract keeps a Frontier army's (army_slots.cairo:
 * the slot the army was allocated, whose allocation made its progress), well short of its maximum.
 */
const staminaSpent = (store: NativeFactStore, now: number): LabFact[] => {
  const [key, army] = armyRow(store, BigInt(SPIRE_ARMY));
  const slot = [...store.entries("ArmySlot")].find(([, row]) => row.structure_id === army.owner && row.slot === 0);
  if (!slot) throw new Error("The upkeep army needs its home's first army slot");
  const [slotKey, row] = slot;
  return [
    { model: "ExplorerTroops", key, value: wire({ ...army, troops: { ...army.troops, stamina: { Slot: 0 } } }) },
    {
      model: "ArmySlot",
      key: slotKey,
      value: wire({
        ...row,
        explorer_id: SPIRE_ARMY,
        stamina: { amount: STAMINA_LEFT, settled_at: now, remainder: 0 },
      }),
    },
  ];
};

/** The army's progress, every attribute common, and XP's prices (Frontier's: config/source/frontier/native.ts). */
const progressHeld = (store: NativeFactStore): LabFact => {
  const [key, progress] = progressOf(store, BigInt(SPIRE_ARMY));
  return { model: "ArmyProgress", key, value: wire({ ...progress, xp: XP_HELD, uncommon_points: 1 }) };
};

const progressOf = (chain: NativeFactStore, explorerId: bigint) =>
  [...chain.entries("ArmyProgress")].find(([, row]) => BigInt(row.explorer_id) === explorerId)!;

/**
 * The army's bar now and its maximum, through the client's one explorer bar resolver, which reads the slot as the
 * contract does (progression.cairo's stamina_max: the troop's base, its Logistics added).
 */
const barOf = (chain: NativeFactStore, explorerId: bigint, now: number) => {
  const [, army] = armyRow(chain, explorerId);
  const troops = resolveExplorerTroops(chain, army);
  if (troops?.staminaMax === undefined) throw new Error("The upkeep army's bar needs its slot, progress and rules");
  const rules = chain.require("SliceRules", { game_id: 1 });
  const tick = Number(configManager.getTick(TickIds.Armies));
  return {
    now: staminaAt(troops, now, rules.troop_stamina_config, tick).amount,
    maximum: BigInt(troops.staminaMax),
  };
};

/** The army's slot with its bar set to `amount` at `now`, as army_slots.cairo persists it. */
const withStamina = (chain: NativeFactStore, explorerId: bigint, amount: bigint, now: number): LabFact => {
  const [key, slot] = [...chain.entries("ArmySlot")].find(([, row]) => row.explorer_id === explorerId)!;
  return { model: "ArmySlot", key, value: wire({ ...slot, stamina: { amount, settled_at: now, remainder: 0 } }) };
};

const refill = (command: LabCommand, chain: NativeFactStore, now: number): LabFact[] => {
  const explorerId = BigInt(command.fields.explorer_id);
  const bar = barOf(chain, explorerId, now);
  const [, army] = armyRow(chain, explorerId);
  const missing = bar.maximum - bar.now;
  return [
    withStamina(chain, explorerId, bar.maximum, now),
    ...balancesPaid(chain, army.owner, [
      { resource: ResourcesIds.Lords, amount: missing * BigInt(RESOURCE_PRECISION) },
    ]),
  ];
};

/** commands.cairo's Attribute, by its variant. */
const ATTRIBUTES = ["battle", "logistics", "scouting", "homecoming"] as const;

const spendPoint = (command: LabCommand, chain: NativeFactStore, now: number): LabFact[] => {
  const [explorerId, choice] = command.calldata.slice(5).map(BigInt);
  const attribute = ATTRIBUTES[Number(choice)];
  if (!attribute || attribute === "scouting") throw new Error(`The lab buys no ${attribute ?? "unknown"} tier`);
  const [key, progress] = progressOf(chain, explorerId);
  const tier = progress[attribute];
  const rank = lowestFittingPoint(progress, tier + 1);
  if (!rank) throw new Error("The lab army has no fitting point");
  const point = ["common_points", "uncommon_points", "rare_points", "epic_points", "legendary_points"] as const;
  const field = point[rank - 1]!;
  const bought = { ...progress, [field]: progress[field] - 1, [attribute]: tier + 1 };
  const bar = barOf(chain, explorerId, now);
  const maximum =
    attribute === "logistics" ? bar.maximum + BigInt(logisticsStamina(tier + 1) - logisticsStamina(tier)) : bar.maximum;
  const refilled = bar.now + BigInt(skillPointRefill(rank));
  return [
    { model: "ArmyProgress", key, value: wire(bought) },
    withStamina(chain, explorerId, refilled > maximum ? maximum : refilled, now),
  ];
};

/** DestroyBuilding (ChangeBuilding: the structure, then its plot as a Coord of alt, x and y): that plot's building gone. */
const demolish = (command: LabCommand, chain: NativeFactStore): LabFact[] => {
  const [, structureId, , col, row] = command.calldata.slice(4).map(BigInt);
  const [key] = [...chain.entries("Building")].find(
    ([, building]) =>
      building.structure_id === structureId && BigInt(building.inner_col) === col && BigInt(building.inner_row) === row,
  )!;
  return [{ model: "Building", key, value: null }];
};

/** A chest on an open tile beside the army, with the LORDS it holds. */
const chestBeside = (store: NativeFactStore): LabFact[] => [
  siteAt("0x1b43", besideOnOpenLand(store, store.entityOccupancy(1, SPIRE_ARMY)!), CHEST, TileOccupier.Chest),
  {
    model: "SiteChest",
    key: "0x1b44",
    value: { game_id: 1, entity_id: CHEST, tier: 1, amount: String(CHEST_LORDS), reservation_day: 0 },
  },
];

/** OpenRelicChest (OpenChest: the army, then the chest's tile as a Coord of alt, x and y). */
const openChest = (command: LabCommand, chain: NativeFactStore): LabFact[] => {
  const [, explorerId, , col, row] = command.calldata.slice(4).map(BigInt);
  const [occupancyKey, occupancy] = [...chain.entries("TileOccupancy")].find(
    ([, tile]) => BigInt(tile.col) === col && BigInt(tile.row) === row,
  )!;
  const [chestKey, chest] = [...chain.entries("SiteChest")].find(([, held]) => held.entity_id === occupancy.entity_id)!;
  const [, army] = armyRow(chain, explorerId);
  const [lordsKey, lords] = [...chain.entries("ResourceBalance")].find(
    ([, held]) => held.entity_id === army.owner && held.resource_type === ResourcesIds.Lords,
  )!;
  return [
    { model: "TileOccupancy", key: occupancyKey, value: null },
    { model: "SiteChest", key: chestKey, value: null },
    { model: "ResourceBalance", key: lordsKey, value: wire({ ...lords, balance: lords.balance + chest.amount }) },
  ];
};

/** WithdrawLords: the realm's whole LORDS debited and the withdrawal recorded under its claim, for the ledger to pay. */
const withdrawLords = (command: LabCommand, chain: NativeFactStore): LabFact[] => {
  const structureId = BigInt(command.fields.structure_id);
  const amount = BigInt(command.fields.amount);
  const claims = [...chain.entries("LordsWithdrawal")].length;
  const owner = chain.require("Structure", { game_id: 1, entity_id: structureId }).owner;
  return [
    ...balancesPaid(chain, structureId, [
      { resource: ResourcesIds.Lords, amount: amount * BigInt(RESOURCE_PRECISION) },
    ]),
    {
      model: "LordsWithdrawal",
      key: `0x1b45${claims}`,
      value: wire({ game_id: 1, claim_id: BigInt(claims + 1), account: owner, amount }),
    },
  ];
};
