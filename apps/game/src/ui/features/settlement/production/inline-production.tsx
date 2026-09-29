import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { getRealmInfo } from "@bibliothecadao/eternum";
import { ResourcesIds, ContractAddress } from "@bibliothecadao/types";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { ProductionControls } from "./production-controls";
import { getPlayerName } from "@/services/identity/player-profiles";

export function InlineProduction({ entityId, resource }: { entityId: number; resource: ResourcesIds }) {
  const {
    setup: { store },
    account: { account },
  } = useGame();
  const ordersAllowed = useUIStore(canIssueOrders);
  useNativeRevision(["Structure", "StructureBuildings", "ResourceWeight"]);
  const realm = getRealmInfo(entityId, store, getPlayerName);
  if (!ordersAllowed || !realm || !account?.address || realm.owner !== ContractAddress(account.address)) return null;
  return <ProductionControls key={`${entityId}:${resource}`} realm={realm} selectedResource={resource} compact />;
}
