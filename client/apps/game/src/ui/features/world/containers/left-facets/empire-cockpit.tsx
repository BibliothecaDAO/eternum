import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_BODY_MUTED } from "@/ui/design-system/atoms/hud-typography";
import { InfoBubble } from "@/ui/features/world/components/entities/collapsible-bubble";
import { CompactEntityInventory } from "@/ui/features/world/components/entities/compact-entity-inventory";
import { useStructureEntityDetail } from "@/ui/features/world/components/entities/hooks/use-structure-entity-detail";
import { StructureProductionPanelView } from "@/ui/features/world/components/entities/structure-production-panel";
import { useStructureProductionSummary } from "@/ui/features/world/components/entities/structure-production-summary";
import { TRANSFER_POPUP_NAME } from "@/ui/features/economy/transfers/transfer-automation-popup";
import { ProductionModal } from "@/ui/features/settlement";
import { RelicRecipientType } from "@bibliothecadao/types";
import Factory from "lucide-react/dist/esm/icons/factory";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Wallet from "lucide-react/dist/esm/icons/wallet";
import { memo, useCallback, useMemo } from "react";

const MAX_BALANCE_ITEMS = 8;

// Always-on data column for the active owned structure (production + balance),
// rendered below StructureListColumn in the left rail.
export const EmpireCockpit = memo(() => {
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);
  const setLogisticsActiveTab = useUIStore((state) => state.setLogisticsActiveTab);
  const setTransferPanelSourceId = useUIStore((state) => state.setTransferPanelSourceId);
  const openPopup = useUIStore((state) => state.openPopup);
  const isTransferPopupOpen = useUIStore((state) => state.isPopupOpen(TRANSFER_POPUP_NAME));
  const toggleModal = useUIStore((state) => state.toggleModal);

  const { structure, resources, isMine, isLoadingStructure } = useStructureEntityDetail({ structureEntityId });
  const productionSummary = useStructureProductionSummary(structure, resources);

  const handleOpenProduction = useCallback(() => {
    if (!structureEntityId) return;
    const id = Number(structureEntityId);
    if (!Number.isFinite(id)) return;
    toggleModal(<ProductionModal preSelectedRealmId={id} />);
  }, [structureEntityId, toggleModal]);

  const handleOpenTransfer = useCallback(() => {
    if (!structureEntityId) return;
    const id = Number(structureEntityId);
    if (!Number.isFinite(id)) return;
    setTransferPanelSourceId(id);
    setLogisticsActiveTab("transfer");
    if (!isTransferPopupOpen) {
      openPopup(TRANSFER_POPUP_NAME);
    }
    setLeftNavigationView(LeftView.ResourceArrivals);
  }, [
    isTransferPopupOpen,
    openPopup,
    setLeftNavigationView,
    setLogisticsActiveTab,
    setTransferPanelSourceId,
    structureEntityId,
  ]);

  const hasProduction = productionSummary.items.length > 0;
  const productionCue = useMemo(
    () =>
      hasProduction
        ? `${productionSummary.activeProductionBuildings}/${productionSummary.totalProductionBuildings}`
        : null,
    [hasProduction, productionSummary.activeProductionBuildings, productionSummary.totalProductionBuildings],
  );

  // Hide cockpit when there's nothing meaningful to show — keeps the rail
  // clean during loads and on non-owned selections.
  if (isLoadingStructure) return null;
  if (!structure || !isMine) return null;

  return (
    <div className="flex flex-col gap-2">
      <InfoBubble
        title="Production"
        icon={Factory}
        cue={
          <span className="flex items-center gap-2">
            {productionCue && <span>{productionCue}</span>}
            <button
              type="button"
              onClick={handleOpenProduction}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gold/25 bg-black/30 text-gold/75 transition hover:border-gold hover:text-gold"
              title="Open production panel"
              aria-label="Open production panel"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </span>
        }
      >
        {hasProduction ? (
          <StructureProductionPanelView
            compact
            smallTextClass="text-xxs"
            showTooltip
            showProductionSummary={false}
            badgeVariant="detailed"
            productionSummary={productionSummary}
          />
        ) : (
          <p className={cn(HUD_BODY_MUTED, "italic")}>No production buildings yet.</p>
        )}
      </InfoBubble>

      <InfoBubble
        title="Balance"
        icon={Wallet}
        cue={
          <button
            type="button"
            onClick={handleOpenTransfer}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gold/25 bg-black/30 text-gold/75 transition hover:border-gold hover:text-gold"
            title="Open transfer"
            aria-label="Open transfer"
          >
            <Pencil className="h-3 w-3" />
          </button>
        }
      >
        <CompactEntityInventory
          resources={resources}
          recipientType={RelicRecipientType.Structure}
          entityId={structureEntityId ? Number(structureEntityId) : undefined}
          variant="tight"
          showLabels={false}
          maxItems={MAX_BALANCE_ITEMS}
          showHiddenCount
          emptyMessage="No resources in this realm yet."
        />
      </InfoBubble>
    </div>
  );
});

EmpireCockpit.displayName = "EmpireCockpit";
