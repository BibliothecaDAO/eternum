import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { canIssueOrders } from "@/utils/can-issue-orders";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { MusterSheet } from "./muster/muster-sheet";

/**
 * The workspaces a Frontier game opens over its map from the view its openers set (the dock's Muster card, the
 * realm's map menu): its own muster sheet. Building has one way in, a tapped plot's build sheet, which opens from the
 * selection. No order surface opens for a realm the player does not own.
 */
export const FrontierSurfaces = ({ realm }: { realm: NativeRows["Structure"] | null }) => {
  const ordersAllowed = useUIStore(canIssueOrders);
  const view = useUIStore((state) => state.leftNavigationView);
  const setView = useUIStore((state) => state.setLeftNavigationView);
  if (!ordersAllowed) return null;
  const close = () => setView(LeftView.None);
  if (view === LeftView.MilitaryView && realm) return <MusterSheet realm={realm} onClose={close} />;
  return null;
};
