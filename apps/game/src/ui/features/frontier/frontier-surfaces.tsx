import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { canIssueOrders } from "@/utils/can-issue-orders";
import type { ExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { DeploySheet } from "./deploy/deploy-sheet";
import { closeDeployOrder } from "./hud/one-panel";

/**
 * The workspace a Frontier game opens over its map for a deploy order (openArmyDeployment: the dock's open slot,
 * Production's spend, a tile beside the realm on the map): its own Deploy sheet. Building has one way in, a tapped
 * plot's build sheet, which opens from the selection. No order surface opens for a realm the player does not own.
 */
export const FrontierSurfaces = ({
  realm,
  rules,
}: {
  realm: NativeRows["Structure"] | null;
  rules: ExpeditionRules;
}) => {
  const ordersAllowed = useUIStore(canIssueOrders);
  const view = useUIStore((state) => state.leftNavigationView);
  if (!ordersAllowed) return null;
  if (view === LeftView.MilitaryView && realm)
    return <DeploySheet realm={realm} rules={rules} onClose={closeDeployOrder} />;
  return null;
};
