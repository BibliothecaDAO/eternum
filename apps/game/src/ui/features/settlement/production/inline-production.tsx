import { usePlayerNames } from "@/hooks/use-player-profile";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { getRealmInfo } from "@bibliothecadao/eternum";
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
  const names = usePlayerNames();
  const realm = getRealmInfo(entityId, store, names.text);
  if (!ordersAllowed || !realm || !account?.address || realm.owner !== ContractAddress(account.address)) return null;
  return <ProductionControls key={`${entityId}:${resource}`} realm={realm} selectedResource={resource} compact />;
}
