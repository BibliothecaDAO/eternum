import { useDojo } from "@bibliothecadao/react";
import { configManager, getRealmInfo } from "@bibliothecadao/eternum";
import { ResourcesIds, ContractAddress } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { gameEntityKey } from "@/sync/game-scope";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { ProductionControls } from "./production-controls";

export function InlineProduction({ entityId, resource }: { entityId: number; resource: ResourcesIds }) {
  const {
    setup: { components },
    account: { account },
  } = useDojo();
  const ordersAllowed = useUIStore(canIssueOrders);
  const entity = gameEntityKey([BigInt(entityId)]);
  useComponentValue(components.Structure, entity);
  useComponentValue(components.StructureBuildings, entity);
  const realm = getRealmInfo(entity, components);
  if (!ordersAllowed || !realm || !account?.address || realm.owner !== ContractAddress(account.address)) return null;
  if (resource === ResourcesIds.Labor && !configManager.isLaborProductionEnabled()) {
    return <p className="text-xs">Labor production is not available in this game.</p>;
  }
  return <ProductionControls key={`${entityId}:${resource}`} realm={realm} selectedResource={resource} compact />;
}
