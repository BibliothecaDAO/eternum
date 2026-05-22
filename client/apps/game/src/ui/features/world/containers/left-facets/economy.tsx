import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { HUD_BODY_MUTED } from "@/ui/design-system/atoms/hud-typography";
import { InfoBubble } from "@/ui/features/world/components/entities/collapsible-bubble";
import { useStructureEntityDetail } from "@/ui/features/world/components/entities/hooks/use-structure-entity-detail";
import { useStructureProductionSummary } from "@/ui/features/world/components/entities/structure-production-summary";
import { StructureProductionPanelView } from "@/ui/features/world/components/entities/structure-production-panel";
import {
  buildDisplayItems,
  CompactEntityInventory,
} from "@/ui/features/world/components/entities/compact-entity-inventory";
import { ProductionModal } from "@/ui/features/settlement";
import { EntityType, ID, RelicRecipientType } from "@bibliothecadao/types";
import Coins from "lucide-react/dist/esm/icons/coins";
import Factory from "lucide-react/dist/esm/icons/factory";
import { memo, useMemo } from "react";

interface EconomyFacetProps {
  structureEntityId: ID;
}

export const EconomyFacet = memo(({ structureEntityId }: EconomyFacetProps) => {
  const detail = useStructureEntityDetail({ structureEntityId });
  const mode = useGameModeConfig();
  const currentDefaultTick = useCurrentDefaultTick();
  const toggleModal = useUIStore((state) => state.toggleModal);

  const productionSummary = useStructureProductionSummary(detail.structure, detail.resources ?? undefined);

  const activeRelicIds = useMemo(
    () => detail.relicEffects.map((effect) => Number(effect.id)),
    [detail.relicEffects],
  );
  const resourceTiers = useMemo(() => mode.resources.getTiers(), [mode]);
  const inventoryItems = useMemo(
    () =>
      buildDisplayItems(
        detail.resources ?? null,
        currentDefaultTick,
        activeRelicIds,
        RelicRecipientType.Structure,
        resourceTiers,
      ),
    [activeRelicIds, currentDefaultTick, detail.resources, resourceTiers],
  );
  void inventoryItems;

  const productionCue =
    productionSummary.totalProductionBuildings > 0
      ? `${productionSummary.activeProductionBuildings}/${productionSummary.totalProductionBuildings}`
      : "0";

  const handleOpenProductionModal = () => {
    if (!detail.structure?.entity_id) return;
    const id = Number(detail.structure.entity_id);
    if (!Number.isFinite(id)) return;
    toggleModal(<ProductionModal preSelectedRealmId={id} />);
  };

  if (!detail.structure) return null;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <InfoBubble title="Production" icon={Factory} cue={productionCue}>
        {detail.resources ? (
          <div className="flex flex-col gap-2">
            <StructureProductionPanelView
              compact
              smallTextClass="text-xxs"
              showProductionSummary
              showTooltip={false}
              productionSummary={productionSummary}
            />
            {detail.isMine && (
              <button
                type="button"
                onClick={handleOpenProductionModal}
                className="self-start rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold hover:bg-gold/20"
              >
                Modify automation
              </button>
            )}
          </div>
        ) : (
          <p className={HUD_BODY_MUTED}>Production data unavailable.</p>
        )}
      </InfoBubble>

      <InfoBubble title="Resources" icon={Coins}>
        {detail.resources ? (
          <CompactEntityInventory
            resources={detail.resources}
            activeRelicIds={activeRelicIds}
            recipientType={RelicRecipientType.Structure}
            entityId={structureEntityId}
            entityType={EntityType.STRUCTURE}
            allowRelicActivation={detail.isMine}
            variant="tight"
            maxItems={14}
          />
        ) : (
          <p className={HUD_BODY_MUTED}>No resources stored.</p>
        )}
      </InfoBubble>
    </div>
  );
});

EconomyFacet.displayName = "EconomyFacet";
