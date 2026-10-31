import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { StructureType } from "@bibliothecadao/types";

import { siteAt } from "./after-battle-scenario";
import type { LabScenario } from "./lab-chain";
import { besideOnOpenLand, spireScenario } from "./spire-scenario";

const PRECISION = 1_000_000_000n;
/** A camp's guard, as the site fixture stands one (campBeside): 1,100 of the army's troop. */
const GUARD_TROOPS = 1_100n;

/**
 * The spire's army beside a standing camp (/lab/game?scenario=camp): a Frontier camp is the Troll's (frontierBeast), so
 * hovering its tile opens the Troll's plate as the map draws it.
 */
export const campScenario = (): LabScenario => {
  const spire = spireScenario();
  const { store } = spire;
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
  store.applyFacts(
    siteAt(
      store,
      besideOnOpenLand(store, store.entityOccupancy(1, SPIRE_ARMY)!),
      { ...army.troops, count: GUARD_TROOPS * PRECISION },
      StructureType.Camp,
    ) as never,
  );
  return spire;
};
