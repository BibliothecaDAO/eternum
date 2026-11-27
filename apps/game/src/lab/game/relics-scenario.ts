import { SITE } from "@/ui/features/frontier/sites/site-fixture";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { RELIC_KINDS, type RelicKind } from "@/ui/design-system/domain-icon-meaning";
import { relicSeconds, type ArmyRelic } from "@/ui/features/frontier/relics/relic-catalog";
import { armyRelicRank, type ArmyRelicLoadout } from "@bibliothecadao/eternum";
import { StructureType } from "@bibliothecadao/types";

import { siteAt } from "./after-battle-scenario";
import { type LabCommand, type LabFact, type LabScenario, wire } from "./lab-chain";
import { besideOnOpenLand, spireScenario } from "./spire-scenario";

const PRECISION = 1_000_000_000n;
const ARMY = BigInt(SPIRE_ARMY);
const CARRIED: ArmyRelicLoadout = {
  blade: 2,
  ward: 1,
  plunder: 3,
  stamina_regen: 0,
  antidote: 2,
};

const FIELD_BY_KIND: Record<RelicKind, keyof ArmyRelicLoadout> = {
  Blade: "blade",
  Ward: "ward",
  Plunder: "plunder",
  StaminaRegen: "stamina_regen",
  Antidote: "antidote",
};

export const seedArmyRelics = (startsAt: number): LabFact[] => [
  armyRelics(CARRIED),
  effect({ kind: "Ward", rank: 3 }, startsAt + 1_200),
];

export const relicsScenario = (): LabScenario => {
  const spire = spireScenario();
  const { store, startsAt } = spire;
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: ARMY });
  const ruinTile = besideOnOpenLand(store, store.entityOccupancy(1, SPIRE_ARMY)!);
  store.applyFacts([
    ...siteAt(store, ruinTile, { ...army.troops, count: 10_000n * PRECISION }, StructureType.Ruin),
    { model: "RuinRelic", key: "0x1abf0", value: { game_id: 1, entity_id: SITE, kind: "Blade", rank: 2 } },
    ...seedArmyRelics(startsAt),
  ] as never);
  return {
    ...spire,
    answer: (command, chain, now) =>
      command.kind === "ApplyRelic" ? switchOn(command, chain, now) : spire.answer(command, chain, now),
  };
};

const armyRelics = (loadout: ArmyRelicLoadout): LabFact => ({
  model: "ArmyRelics",
  key: "0x1abf1",
  value: wire({ game_id: 1, explorer_id: ARMY, ...loadout }),
});

const effect = (relic: ArmyRelic, expiresAt: number): LabFact => ({
  model: "ArmyRelicEffect",
  key: `0x1abf2${RELIC_KINDS.indexOf(relic.kind)}`,
  value: wire({ game_id: 1, explorer_id: ARMY, kind: relic.kind, rank: relic.rank, expires_at: expiresAt }),
});

const switchOn = (command: LabCommand, chain: LabScenario["store"], now: number): LabFact[] => {
  const [, , kindIndex, expectedRank] = command.span.map(Number);
  const kind = RELIC_KINDS[kindIndex];
  if (!kind) return [];
  const carried = chain.require("ArmyRelics", { game_id: 1, explorer_id: ARMY });
  const rank = armyRelicRank(carried, kind);
  if (rank === 0 || rank !== expectedRank) return [];
  const next: ArmyRelicLoadout = {
    blade: carried.blade,
    ward: carried.ward,
    plunder: carried.plunder,
    stamina_regen: carried.stamina_regen,
    antidote: carried.antidote,
    [FIELD_BY_KIND[kind]]: 0,
  };
  const relic = { kind, rank };
  const seconds = relicSeconds(relic, chain.require("SliceRules", { game_id: 1 }));
  return [armyRelics(next), effect(relic, now + seconds)];
};
