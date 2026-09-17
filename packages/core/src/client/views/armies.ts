import type { ArmyInfo, ContractAddress, ID } from "@bibliothecadao/types";
import type { NativeFactStore } from "../native-fact-store";
import { configManager } from "../../managers/config-manager";
import { StaminaManager } from "../../managers/stamina-manager";
import { formatArmies } from "../../utils/army";

export const readExplorers = (store: NativeFactStore, structureEntityId: ID, viewer: ContractAddress): ArmyInfo[] =>
  formatArmies(
    [...store.inGame("ExplorerTroops", configManager.getActiveGameId())].filter(
      (row) => row.owner === structureEntityId,
    ),
    viewer,
    store,
  );

export const readStaminaManager = (store: NativeFactStore, armyEntityId: ID): StaminaManager =>
  new StaminaManager(store, armyEntityId);
