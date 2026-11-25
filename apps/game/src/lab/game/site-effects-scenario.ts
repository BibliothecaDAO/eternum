import { nativeRaceConstants } from "@bibliothecadao/eternum/game-client";
import { StructureType } from "@bibliothecadao/types";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { SITE } from "@/ui/features/frontier/sites/site-fixture";
import { siteAt } from "./after-battle-scenario";
import { raceRules } from "./race-scenario";
import { besideOnOpenLand, spireScenario } from "./spire-scenario";
import { wire, type LabFact, type LabScenario } from "./lab-chain";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

/** A camp on the recorded Pale Moon and Spoils day, read through the production card and map plates. */
export function siteEffectsScenario(): LabScenario {
  const scenario = spireScenario();
  const { store } = scenario;
  store.applyFacts([
    ...homeCampBesideArmy(store),
    { model: "RaceRules", key: "0xc100", value: wire(raceRules()) },
    { model: "HomeAspect", key: "0xc101", value: { game_id: 1, home: "7", aspect: 1 } },
    ...[nativeRaceConstants.PALE_MOON_STAGE, nativeRaceConstants.SPOILS_STAGE].map((stage) => ({
      model: "TriumphDay",
      key: `0xc10${stage}`,
      value: { game_id: 1, aspect: 1, stage, day: 0 },
    })),
  ] as never);
  return scenario;
}

export const homeCampBesideArmy = (store: NativeFactStore): LabFact[] => {
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: SPIRE_ARMY });
  const tile = besideOnOpenLand(store, store.entityOccupancy(1, SPIRE_ARMY)!);
  const entityId = (7n << 32n) + BigInt(SITE);
  const guard = {
    ...army.troops,
    count: 1_000_000_000_000n,
    stamina: { Inline: { amount: 0n, settled_at: 0, remainder: 0 } },
  };
  return siteAt(store, tile, guard, StructureType.Camp).map((fact): LabFact => {
    const value = fact.value as Record<string, unknown>;
    return {
      ...fact,
      value: {
        ...value,
        ...(value.entity_id !== undefined ? { entity_id: String(entityId) } : {}),
        ...(value.structure_id !== undefined ? { structure_id: String(entityId) } : {}),
      },
    };
  });
};
