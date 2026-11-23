import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

import { actionsScenario } from "./actions-scenario";
import { chainOf, LAB_LINKED_WALLET, wire, type LabCommand, type LabFact, type LabScenario } from "./lab-chain";
/** The army's stamina after a day of exploring. */
const STAMINA_LEFT = 40n;

export const upkeepScenario = (): LabScenario => {
  const actions = actionsScenario();
  // Its rows rewritten under the keys the chain serves them by, so a fact below changes the row it names.
  const store = chainOf(actions);
  store.applyFacts(staminaSpent(store, actions.startsAt) as never);
  const answers: Record<string, (command: LabCommand, chain: NativeFactStore, now: number) => LabFact[]> = {
    DestroyBuilding: demolish,
  };
  return {
    ...actions,
    store,
    wallet: LAB_LINKED_WALLET,
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

/** DestroyBuilding (ChangeBuilding: the structure, then its plot as a Coord of alt, x and y): that plot's building gone. */
const demolish = (command: LabCommand, chain: NativeFactStore): LabFact[] => {
  const [, structureId, , col, row] = command.span.map(BigInt);
  const [key] = [...chain.entries("Building")].find(
    ([, building]) =>
      building.structure_id === structureId && BigInt(building.inner_col) === col && BigInt(building.inner_row) === row,
  )!;
  return [{ model: "Building", key, value: null }];
};
