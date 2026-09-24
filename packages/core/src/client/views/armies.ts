import type { ArmyInfo, ContractAddress, ID } from "@bibliothecadao/types";
import type { NativeFactStore } from "../native-fact-store";
import { configManager } from "../../managers/config-manager";
import { StaminaManager } from "../../managers/stamina-manager";
import { formatArmies } from "../../utils/army";
import type { PlayerNameResolver } from "../../utils/entities";
import { liveHomeArmies } from "../../utils/expeditions";

export const readExplorers = (
  store: NativeFactStore,
  structureEntityId: ID,
  viewer: ContractAddress,
  playerName: PlayerNameResolver,
): ArmyInfo[] =>
  formatArmies(liveHomeArmies(store, structureEntityId, configManager.getActiveGameId()), viewer, store, playerName);

export const readStaminaManager = (store: NativeFactStore, armyEntityId: ID): StaminaManager =>
  new StaminaManager(store, armyEntityId);
