import { configManager, logisticsStamina, lowestFittingPoint, skillPointRefill } from "@bibliothecadao/eternum";
import { resolveExplorerTroops, staminaAt } from "@bibliothecadao/eternum/troop-stamina";
import { TickIds } from "@bibliothecadao/types";

import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

import { actionsScenario } from "./actions-scenario";
import { chainOf, wire, type LabCommand, type LabFact, type LabScenario } from "./lab-chain";
/** The army's stamina after a day of exploring. */
const STAMINA_LEFT = 40n;
/** XP enough for an uncommon tier in any attribute. */
const XP_HELD = 500;

/** The army has spent stamina and holds a skill point; its orders use the ordinary upkeep rules. */
export const upkeepScenario = (): LabScenario => {
  const actions = actionsScenario();
  // Its rows rewritten under the keys the chain serves them by, so a fact below changes the row it names.
  const store = chainOf(actions);
  store.applyFacts([...staminaSpent(store, actions.startsAt), progressHeld(store)] as never);
  const answers: Record<string, (command: LabCommand, chain: NativeFactStore, now: number) => LabFact[]> = {
    SpendSkillPoint: spendPoint,
    DestroyBuilding: demolish,
  };
  return {
    ...actions,
    store,
    wallet: "0x456",
    answer: (command, chain, now) => (answers[command.kind] ?? actions.answer)(command, chain, now),
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
