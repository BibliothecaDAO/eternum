import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import {
  HUD_BODY_MUTED,
  HUD_HEADLINE,
  HUD_LABEL,
  HUD_LABEL_BRIGHT,
} from "@/ui/design-system/atoms/hud-typography";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { CompactDefenseDisplay } from "@/ui/features/military";
import { useStructureEntityDetail } from "@/ui/features/world/components/entities/hooks/use-structure-entity-detail";
import { FELT_CENTER } from "@bibliothecadao/eternum";
import { type ID } from "@bibliothecadao/types";
import Shield from "lucide-react/dist/esm/icons/shield";
import Swords from "lucide-react/dist/esm/icons/swords";
import Crosshair from "lucide-react/dist/esm/icons/crosshair";
import { memo, useMemo } from "react";

interface MilitaryModalProps {
  structureEntityId: ID;
}

/**
 * Military view rendered as a centered modal. Replaces the old left-rail
 * Military facet. Two sections:
 *
 *   1. Guards — the structure's defenders (existing CompactDefenseDisplay).
 *      Slot management lives inside the display (ADD button per empty slot).
 *   2. Armies — the player's explorer armies on the map. Click a row to jump
 *      the camera to that army.
 */
export const MilitaryModal = memo(({ structureEntityId }: MilitaryModalProps) => {
  const detail = useStructureEntityDetail({ structureEntityId });
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const selectableArmies = useUIStore((state) => state.selectableArmies);
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);

  const occupiedGuardSlots = useMemo(
    () => detail.guards.filter((guard) => Number(guard.troops?.count ?? 0) > 0).length,
    [detail.guards],
  );

  if (!detail.structure) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className={HUD_BODY_MUTED}>Select a structure to view its military.</p>
      </div>
    );
  }

  const guardCue =
    detail.guardSlotsMax !== undefined
      ? `${occupiedGuardSlots}/${detail.guardSlotsMax}`
      : `${occupiedGuardSlots}`;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-6">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Swords className="h-5 w-5 text-gold" />
          <h2 className={HUD_HEADLINE}>Military · {detail.structureName ?? "Structure"}</h2>
        </div>
      </header>

      <section className={cn("rounded-xl p-4", OVERLAY_SURFACE_BASE)}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className={cn("flex items-center gap-2", HUD_LABEL_BRIGHT)}>
            <Shield className="h-4 w-4 text-gold" />
            Guards
          </span>
          <span className={HUD_LABEL}>{guardCue}</span>
        </div>
        {detail.guards.length > 0 || (detail.guardSlotsMax ?? 0) > 0 ? (
          <CompactDefenseDisplay
            troops={detail.guards.map((army) => ({ slot: army.slot, troops: army.troops }))}
            slotsUsed={detail.guardSlotsUsed}
            slotsMax={detail.guardSlotsMax}
            structureId={Number(detail.structure.entity_id ?? 0)}
            canManageDefense={detail.isMine}
            variant="default"
          />
        ) : (
          <p className={HUD_BODY_MUTED}>This structure can't hold defenders.</p>
        )}
      </section>

      <section className={cn("rounded-xl p-4", OVERLAY_SURFACE_BASE)}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className={cn("flex items-center gap-2", HUD_LABEL_BRIGHT)}>
            <Crosshair className="h-4 w-4 text-gold" />
            Armies on the map
          </span>
          <span className={HUD_LABEL}>{selectableArmies.length}</span>
        </div>
        {selectableArmies.length === 0 ? (
          <p className={HUD_BODY_MUTED}>You have no explorer armies deployed.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {selectableArmies.map((army) => {
              const normalizedCol = army.position.col - FELT_CENTER();
              const normalizedRow = army.position.row - FELT_CENTER();
              return (
                <button
                  key={army.entityId}
                  type="button"
                  onClick={() => {
                    setSelectedHex({ col: army.position.col, row: army.position.row });
                    setLeftNavigationView(LeftView.None);
                  }}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gold/25 bg-black/30 px-3 py-2 text-left transition hover:border-gold/60 hover:bg-black/45"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold text-gold">{army.name}</span>
                    <span className={cn(HUD_LABEL, "text-gold/55")}>
                      ({normalizedCol}, {normalizedRow})
                    </span>
                  </span>
                  <span className="flex-shrink-0 rounded-full border border-gold/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-gold/70">
                    Jump
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
});

MilitaryModal.displayName = "MilitaryModal";
