import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import {
  HUD_BODY_MUTED,
  HUD_LABEL,
  HUD_LABEL_BRIGHT,
} from "@/ui/design-system/atoms/hud-typography";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { CompactDefenseDisplay } from "@/ui/features/military";
import { CenteredModalShell } from "@/ui/features/world/containers/centered-modal-shell";
import { REALMS_ONLY_FILTER, StructureSidebar } from "@/ui/features/world/containers/structure-sidebar";
import type { StructureWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/chip";
import { useStructureEntityDetail } from "@/ui/features/world/components/entities/hooks/use-structure-entity-detail";
import { FELT_CENTER } from "@bibliothecadao/eternum";
import { type ID } from "@bibliothecadao/types";
import Crosshair from "lucide-react/dist/esm/icons/crosshair";
import Shield from "lucide-react/dist/esm/icons/shield";
import Swords from "lucide-react/dist/esm/icons/swords";
import { memo, useCallback, useEffect, useMemo, useState } from "react";

interface MilitaryModalProps {
  structureEntityId: ID;
}

// Right pane — guards + the player's roving armies. Lives below the sidebar
// header so the realm name + level chip read first; sidebar handles the
// realm switching.
const MilitaryBody = ({ focusedRealmId }: { focusedRealmId: ID }) => {
  const detail = useStructureEntityDetail({ structureEntityId: focusedRealmId });
  const selectableArmies = useUIStore((state) => state.selectableArmies);
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);

  const occupiedGuardSlots = useMemo(
    () => detail.guards.filter((guard) => Number(guard.troops?.count ?? 0) > 0).length,
    [detail.guards],
  );

  if (!detail.structure) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className={HUD_BODY_MUTED}>Loading structure...</p>
      </div>
    );
  }

  const guardCue =
    detail.guardSlotsMax !== undefined ? `${occupiedGuardSlots}/${detail.guardSlotsMax}` : `${occupiedGuardSlots}`;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto px-5 py-4">
      <header className="flex items-center justify-between gap-2 border-b border-gold/15 pb-3">
        <div className="flex flex-col gap-0.5">
          <span className={cn("flex items-center gap-2", HUD_LABEL_BRIGHT)}>
            <Swords className="h-4 w-4 text-gold" />
            {detail.structureName ?? "Structure"}
          </span>
          <span className={cn(HUD_LABEL, "text-gold/55")}>Level {detail.structure.base?.level ?? 0}</span>
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
};

/**
 * Military view rendered as a centered modal with the shared realm switcher
 * on the left. The player can cycle through every owned realm without
 * leaving the panel — guards manager + explorer list update on each click.
 *
 * "Deploy everything at once" in this pass means one panel for all realms;
 * each garrison action is still a per-realm tx.
 */
export const MilitaryModal = memo(({ structureEntityId }: MilitaryModalProps) => {
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);
  const close = useCallback(() => setLeftNavigationView(LeftView.None), [setLeftNavigationView]);

  // Local focus — swapping realms inside the modal doesn't touch the global
  // active structure, so closing the modal returns the player to where they
  // were before they opened it.
  const [focusedRealmId, setFocusedRealmId] = useState<ID>(structureEntityId);

  // If the global active structure changes while the modal is open (e.g. the
  // player clicked a chip), sync focus so they see what they expect.
  useEffect(() => {
    setFocusedRealmId(structureEntityId);
  }, [structureEntityId]);

  // Empty guard slot = attention.
  const attention = useCallback((structure: StructureWithMetadata) => {
    const base = structure.structure?.base;
    const occupied = Number(base?.troop_guard_count ?? 0);
    const max = Number(base?.troop_max_guard_count ?? 0);
    return max > 0 && occupied < max;
  }, []);

  return (
    <CenteredModalShell title="Military" icon={Swords} onClose={close} size="wide">
      <div className="grid h-full grid-cols-12 min-h-0">
        <div className="col-span-4 border-r border-gold/15 min-h-0">
          <StructureSidebar
            selectedEntityId={focusedRealmId}
            onSelectStructure={setFocusedRealmId}
            attention={attention}
            filter={REALMS_ONLY_FILTER}
          />
        </div>
        <div className="col-span-8 min-h-0">
          <MilitaryBody focusedRealmId={focusedRealmId} />
        </div>
      </div>
    </CenteredModalShell>
  );
});

MilitaryModal.displayName = "MilitaryModal";
