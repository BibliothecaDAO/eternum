import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { BuildSurface } from "@/ui/features/world/containers/left-view-surfaces";
import { canIssueOrders } from "@/utils/can-issue-orders";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { MusterSheet } from "./muster/muster-sheet";

/**
 * The workspaces a Frontier game opens over its map, from the same view every opener sets (the dock's Muster card,
 * the realm's map menu): its own muster sheet, and the shared build until Frontier's own build sheet replaces it.
 * No order surface opens for a realm the player does not own.
 */
export const FrontierSurfaces = ({ realm }: { realm: NativeRows["Structure"] | null }) => {
  const ordersAllowed = useUIStore(canIssueOrders);
  const view = useUIStore((state) => state.leftNavigationView);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const setView = useUIStore((state) => state.setLeftNavigationView);
  if (!ordersAllowed) return null;
  const close = () => setView(LeftView.None);
  if (view === LeftView.MilitaryView && realm) return <MusterSheet realm={realm} onClose={close} />;
  if (view === LeftView.ConstructionView) return <BuildSurface structureEntityId={structureEntityId} onClose={close} />;
  return null;
};
