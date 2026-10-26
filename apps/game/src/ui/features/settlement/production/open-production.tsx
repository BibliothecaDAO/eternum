import { usePopoverStore } from "@/hooks/store/use-popover-store";
import type { ResourcesIds } from "@bibliothecadao/types";

import { ProductionModal } from "./production-modal";

/** The Production window's surface id: one window, wherever it is opened from. */
export const PRODUCTION_SURFACE_ID = "production";

/**
 * The one way to open the Production window: on a holding (the selected one when none is named), and on a resource
 * of it when one is named.
 */
export const openProduction = ({ realmId, resource }: { realmId?: number; resource?: ResourcesIds } = {}) =>
  usePopoverStore.getState().openSurface({
    id: PRODUCTION_SURFACE_ID,
    content: <ProductionModal preSelectedRealmId={realmId} preSelectedResource={resource} />,
  });
