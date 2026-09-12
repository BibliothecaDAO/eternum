import type { ArmyInfo, ClientComponents, ContractAddress, ID } from "@bibliothecadao/types";
import { type Entity, HasValue, type QueryFragment } from "@dojoengine/recs";

import { StaminaManager } from "../../managers/stamina-manager";
import { formatArmies } from "../../utils/army";

/** The explorer armies a structure fields. */
export const explorersByStructureQuery = (components: ClientComponents, structureEntityId: ID): QueryFragment[] => [
  HasValue(components.ExplorerTroops, { owner: structureEntityId }),
];

/** isMine, isHome, and adjacency are relative to the viewer, so the same army reads differently per player. */
export const readExplorers = (components: ClientComponents, entities: Entity[], viewer: ContractAddress): ArmyInfo[] =>
  formatArmies(entities, viewer, components);

/** The manager reads the army's ExplorerTroops row on every call; a hook re-creates it when that row changes. */
export const readStaminaManager = (components: ClientComponents, armyEntityId: ID): StaminaManager =>
  new StaminaManager(components, armyEntityId);
