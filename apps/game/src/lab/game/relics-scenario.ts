import { SITE } from "@/ui/features/frontier/sites/site-fixture";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { RELIC_KINDS, relicSeconds, type ArmyRelic } from "@/ui/features/frontier/relics/relic-catalog";
import { StructureType } from "@bibliothecadao/types";

import { siteAt } from "./after-battle-scenario";
import { type LabCommand, type LabFact, type LabScenario, wire } from "./lab-chain";
import { besideOnOpenLand, spireScenario } from "./spire-scenario";

const PRECISION = 1_000_000_000n;
const ARMY = BigInt(SPIRE_ARMY);
/** What the army carries: three relics, so the ruin's relic asks which one it replaces. */
const CARRIED: [ArmyRelic, ArmyRelic, ArmyRelic] = [
  { kind: "Blade", rank: 2 },
  { kind: "Tome", rank: 1 },
  { kind: "Plunder", rank: 3 },
];

/**
 * An army's relics in a Season 1 day (/lab/game?scenario=relics): the spire's army carrying three relics, a Rare Ward
 * running, beside a ruin whose beast guards an Epic Blade. The chain answers ApplyRelic as army_relics.cairo does: the
 * slot's relic is spent and its kind runs for 30 minutes a tier (a Far-Eye reveals at once and leaves nothing running).
 * Every other command is the spire's.
 */
export const relicsScenario = (): LabScenario => {
  const spire = spireScenario();
  const { store, startsAt } = spire;
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: ARMY });
  const ruinTile = besideOnOpenLand(store, store.entityOccupancy(1, SPIRE_ARMY)!);
  store.applyFacts([
    ...siteAt(store, ruinTile, { ...army.troops, count: 10_000n * PRECISION }, StructureType.Ruin),
    { model: "RuinRelic", key: "0x1abf0", value: { game_id: 1, entity_id: SITE, kind: "Blade", rank: 4 } },
    armyRelics(CARRIED),
    effect({ kind: "Ward", rank: 3 }, startsAt + 1_200),
  ] as never);
  return {
    ...spire,
    answer: (command, chain, now) =>
      command.kind === "ApplyRelic" ? switchOn(command, chain, now) : spire.answer(command, chain, now),
  };
};

const armyRelics = (slots: (ArmyRelic | null)[]): LabFact => ({
  model: "ArmyRelics",
  key: "0x1abf1",
  value: wire({ game_id: 1, explorer_id: ARMY, first: slots[0], second: slots[1], third: slots[2] }),
});

const effect = (relic: ArmyRelic, expiresAt: number): LabFact => ({
  model: "ArmyRelicEffect",
  key: `0x1abf2${RELIC_KINDS.indexOf(relic.kind)}`,
  value: wire({ game_id: 1, explorer_id: ARMY, kind: relic.kind, rank: relic.rank, expires_at: expiresAt }),
});

/** ApplyRelic's span after the variant: the army, the relic's id (kind index × 5 + tier), then ArmySlot and its slot. */
const switchOn = (command: LabCommand, chain: LabScenario["store"], now: number): LabFact[] => {
  const [, , relicId, , slot] = command.calldata.slice(4).map(Number);
  const carried = chain.require("ArmyRelics", { game_id: 1, explorer_id: ARMY });
  const slots = [carried.first, carried.second, carried.third].map(
    (held) => held && { kind: held.kind, rank: held.rank },
  );
  const relic = slots[slot];
  if (!relic || RELIC_KINDS.indexOf(relic.kind) * 5 + relic.rank !== relicId) return [];
  slots[slot] = null;
  const seconds = relicSeconds(relic);
  return [armyRelics(slots), ...(seconds === null ? [] : [effect(relic, now + seconds)])];
};
