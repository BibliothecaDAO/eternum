import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { ModalContainer } from "@/ui/shared";
import { Position } from "@bibliothecadao/eternum";
import { useDojo, usePlayerOwnedRealmsInfo, usePlayerOwnedVillagesInfo, useQuery } from "@bibliothecadao/react";
import { ID, RealmInfo, ResourcesIds } from "@bibliothecadao/types";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";

const ProductionSidebar = lazy(() =>
  import("./production-sidebar").then((module) => ({ default: module.ProductionSidebar })),
);

const ProductionBody = lazy(() => import("./production-body").then((module) => ({ default: module.ProductionBody })));

const ProductionContainer = ({
  playerStructures,
  preSelectedResource,
}: {
  playerStructures: RealmInfo[];
  preSelectedResource?: ResourcesIds;
}) => {
  const { setup } = useDojo();
  const initialRealm = useMemo(() => {
    const structureEntityId = useUIStore.getState().structureEntityId;
    const selectedRealm = playerStructures.find((structure) => structure.entityId === structureEntityId);
    return selectedRealm;
  }, [playerStructures]);

  const [selectedRealm, setSelectedRealm] = useState<RealmInfo | undefined>(initialRealm || playerStructures[0]);
  const [selectedResource, setSelectedResource] = useState<ResourcesIds | null>(preSelectedResource ?? null);
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const goToStructure = useGoToStructure(setup);
  const { isMapView } = useQuery();

  useEffect(() => {
    if (preSelectedResource === undefined) return;
    setSelectedResource(preSelectedResource ?? null);
  }, [preSelectedResource]);

  const focusRealm = useCallback(
    (realm: RealmInfo | undefined) => {
      if (!realm) return;
      setStructureEntityId(realm.entityId);
      const position = new Position({ x: realm.position.x, y: realm.position.y });
      void goToStructure(realm.entityId, position, isMapView);
    },
    [goToStructure, isMapView, setStructureEntityId],
  );

  const handleSelectRealm = useCallback(
    (id: ID) => {
      const realm = playerStructures.find((structure) => structure.entityId === id);
      setSelectedRealm(realm);
      setSelectedResource(null);
      focusRealm(realm);
    },
    [playerStructures, focusRealm],
  );

  const handleManageResource = useCallback(
    (realmId: ID, resource: ResourcesIds) => {
      const realm = playerStructures.find((structure) => structure.entityId === realmId) || selectedRealm;
      if (realm) {
        setSelectedRealm(realm);
        setSelectedResource(resource);
        focusRealm(realm);
      }
    },
    [playerStructures, selectedRealm, focusRealm],
  );

  return (
    <div className="production-modal-selector container mx-auto grid h-full grid-cols-1 gap-4 rounded-2xl bg-dark-wood lg:grid-cols-12 lg:gap-0">
      <div className="order-1 col-span-1 overflow-y-auto border-b border-gold/20 p-4 pb-8 panel-wood-right lg:order-1 lg:col-span-4 lg:border-b-0 lg:border-r lg:border-gold/20 lg:pb-36">
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
      <div className="order-2 col-span-1 h-full overflow-y-auto p-4 pb-12 lg:order-2 lg:col-span-8 lg:p-8 lg:pb-36">
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

export const ProductionModal = ({ preSelectedResource }: { preSelectedResource?: ResourcesIds }) => {
  const playerRealms = usePlayerOwnedRealmsInfo();
  const playerVillages = usePlayerOwnedVillagesInfo();
  const mode = useGameModeConfig();

  const managedStructures = useMemo(() => {
    const combined = [...playerRealms, ...playerVillages]
      .slice()
      .sort((a, b) =>
        mode.structure
          .getName(a.structure)
          .name.localeCompare(mode.structure.getName(b.structure).name),
      );
    return combined;
  }, [mode, playerRealms, playerVillages]);

  return (
    <ModalContainer size="full">
      <ProductionContainer playerStructures={managedStructures} preSelectedResource={preSelectedResource} />
    </ModalContainer>
  );
};
