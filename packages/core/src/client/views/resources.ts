import type { ID, ResourceArrivalInfo } from "@bibliothecadao/types";
import type { NativeFactStore } from "../native-fact-store";
import { configManager } from "../../managers/config-manager";
import { ResourceManager } from "../../managers/resource-manager";
import { formatArrivals } from "../../utils/resource-arrivals";

export const readResourceManager = (store: NativeFactStore, entityId: ID): ResourceManager =>
  new ResourceManager(store, entityId);

export const readResourceArrivals = (store: NativeFactStore, structureEntityId: ID): ResourceArrivalInfo[] =>
  formatArrivals(
    [...store.inGame("ResourceArrival", configManager.getActiveGameId())].filter(
      (row) => row.entity_id === structureEntityId,
    ),
  );
