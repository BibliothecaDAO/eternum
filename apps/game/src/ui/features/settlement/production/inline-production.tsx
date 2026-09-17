import { useGame, useNativeRevision } from "@bibliothecadao/react";
import { configManager, getRealmInfo } from "@bibliothecadao/eternum";
import { ResourcesIds, ContractAddress } from "@bibliothecadao/types";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { ProductionControls } from "./production-controls";

export function InlineProduction({ entityId, resource }: { entityId: number; resource: ResourcesIds }) {
  const {
    setup: { store },
    account: { account },
  } = useGame();
  const ordersAllowed = useUIStore(canIssueOrders);
  useNativeRevision(["Structure", "StructureBuildings", "ResourceWeight"]);
  const realm = getRealmInfo(entityId, store);
  if (!ordersAllowed || !realm || !account?.address || realm.owner !== ContractAddress(account.address)) return null;
  if (resource === ResourcesIds.Labor && !configManager.isLaborProductionEnabled()) {
    return <p className="text-xs">Labor production is not available in this game.</p>;
  }
  return <ProductionControls key={`${entityId}:${resource}`} realm={realm} selectedResource={resource} compact />;
}
