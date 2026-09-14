import { StructureSelect } from "@/ui/design-system/molecules/structure-select";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useOwnedProductionStructureInfos } from "@/hooks/helpers/use-owned-structure-info";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { ID, RealmInfo, ResourcesIds } from "@bibliothecadao/types";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProductionPopupShell } from "./production-popup-shell";
import { resolveInitialSelectedRealm, resolveSelectedRealm } from "./production-selection";

const ProductionSidebar = lazy(() =>
  import("./production-sidebar").then((module) => ({ default: module.ProductionSidebar })),
);

const ProductionBody = lazy(() => import("./production-body").then((module) => ({ default: module.ProductionBody })));

const ProductionContainer = ({
  playerStructures,
  preSelectedRealmId,
  preSelectedResource,
}: {
  playerStructures: RealmInfo[];
  preSelectedRealmId?: ID;
  preSelectedResource?: ResourcesIds;
}) => {
  const mode = useGameModeConfig();
  const [pickerOpen, setPickerOpen] = useState(false);
  const initialRealm = useMemo(() => {
    return resolveInitialSelectedRealm({
      realms: playerStructures,
      preSelectedRealmId,
      currentStructureEntityId: useUIStore.getState().structureEntityId,
    });
  }, [playerStructures, preSelectedRealmId]);

  const [selectedRealm, setSelectedRealm] = useState<RealmInfo | undefined>(initialRealm || playerStructures[0]);
  const [selectedResource, setSelectedResource] = useState<ResourcesIds | null>(preSelectedResource ?? null);
  const previousPreSelectedRealmId = useRef<ID | undefined>(preSelectedRealmId);

  useEffect(() => {
    const selectedRealmMissing = !selectedRealm;
    const selectedRealmRemoved =
      selectedRealm !== undefined &&
      !playerStructures.some((structure) => structure.entityId === selectedRealm.entityId);
    const preSelectedRealmChanged = previousPreSelectedRealmId.current !== preSelectedRealmId;

    previousPreSelectedRealmId.current = preSelectedRealmId;

    if (selectedRealmMissing || selectedRealmRemoved || preSelectedRealmChanged) {
      setSelectedRealm(initialRealm || playerStructures[0]);
    }
  }, [initialRealm, playerStructures, preSelectedRealmId, selectedRealm]);

  useEffect(() => {
    if (preSelectedResource === undefined) return;
    setSelectedResource(preSelectedResource ?? null);
  }, [preSelectedResource]);

  const handleSelectRealm = useCallback(
    (id: ID) => {
      const realm = resolveSelectedRealm({
        realms: playerStructures,
        realmId: id,
      });
      setSelectedRealm(realm);
      setSelectedResource(null);
      setPickerOpen(false);
    },
    [playerStructures],
  );

  const handleManageResource = useCallback(
    (realmId: ID, resource: ResourcesIds) => {
      const realm = resolveSelectedRealm({
        realms: playerStructures,
        realmId,
        fallbackRealm: selectedRealm,
      });

      if (realm) {
        setSelectedRealm(realm);
        setSelectedResource(resource);
        setPickerOpen(false);
      }
    },
    [playerStructures, selectedRealm],
  );

  return (
    <div className="production-modal-selector flex h-full min-h-0 flex-col overflow-hidden lg:grid lg:grid-cols-12">
      <div className="flex shrink-0 items-center gap-2 border-b border-gold/15 px-3 py-1 lg:hidden">
        <div className="min-w-0 flex-1">
          <StructureSelect
            value={selectedRealm?.entityId ?? 0}
            onChange={handleSelectRealm}
            options={playerStructures.map((realm) => ({
              entityId: realm.entityId,
              name: mode.structure.getName(realm.structure).name,
            }))}
          />
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen(!pickerOpen)}
          aria-expanded={pickerOpen}
          className="min-h-11 shrink-0 px-2 text-sm text-gold underline underline-offset-4"
          aria-label={pickerOpen ? "Back to production" : "Browse production and presets"}
        >
          {pickerOpen ? "Back" : "Browse"}
        </button>
      </div>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-2 py-3 lg:col-span-3 lg:border-r lg:border-gold/15",
          !pickerOpen && "max-lg:hidden",
        )}
      >
        <Suspense fallback={<LoadingAnimation />}>
          {playerStructures.length > 0 && (
            <ProductionSidebar
              realms={playerStructures}
              selectedRealmEntityId={selectedRealm?.entityId || 0}
              onSelectRealm={handleSelectRealm}
              onSelectResource={handleManageResource}
            />
          )}
        </Suspense>
      </div>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 lg:col-span-9 lg:p-4",
          pickerOpen && "max-lg:hidden",
        )}
      >
        <Suspense fallback={<LoadingAnimation />}>
          {selectedRealm && (
            <ProductionBody
              realm={selectedRealm}
              selectedResource={selectedResource}
              onSelectResource={setSelectedResource}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
};

export const ProductionModal = ({
  preSelectedRealmId,
  preSelectedResource,
}: {
  preSelectedRealmId?: ID;
  preSelectedResource?: ResourcesIds;
}) => {
  const playerStructures = useOwnedProductionStructureInfos();
  const mode = useGameModeConfig();

  const managedStructures = useMemo(() => {
    return playerStructures.toSorted((a, b) =>
      mode.structure.getName(a.structure).name.localeCompare(mode.structure.getName(b.structure).name),
    );
  }, [mode, playerStructures]);

  return (
    <ProductionPopupShell>
      <ProductionContainer
        playerStructures={managedStructures}
        preSelectedRealmId={preSelectedRealmId}
        preSelectedResource={preSelectedResource}
      />
    </ProductionPopupShell>
  );
};
