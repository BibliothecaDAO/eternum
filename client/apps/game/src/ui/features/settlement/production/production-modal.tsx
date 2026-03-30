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
      }
    },
    [playerStructures, selectedRealm],
  );

  return (
    <div className="production-modal-selector grid h-full min-h-0 grid-cols-1 gap-4 overflow-hidden rounded-2xl bg-dark-wood lg:grid-cols-12 lg:gap-0">
      <div className="order-1 col-span-1 min-h-0 overflow-y-auto border-b border-gold/20 p-4 pb-4 panel-wood-right lg:order-1 lg:col-span-4 lg:border-b-0 lg:border-r lg:border-gold/20">
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
      <div className="order-2 col-span-1 min-h-0 overflow-y-auto p-4 lg:order-2 lg:col-span-8 lg:p-6">
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
