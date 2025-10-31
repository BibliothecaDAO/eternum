import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { ModalContainer } from "@/ui/shared";
import { getIsBlitz, getStructureName, Position } from "@bibliothecadao/eternum";
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
    <div className="production-modal-selector container mx-auto grid grid-cols-12 bg-dark-wood h-full row-span-12 rounded-2xl relative">
      <div className="col-span-4 p-4 pb-36 row-span-10 overflow-y-auto panel-wood-right">
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
      <div className="col-span-8 h-full row-span-10 overflow-y-auto p-8 pb-36">
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

  const managedStructures = useMemo(() => {
    const isBlitz = getIsBlitz();
    const combined = [...playerRealms, ...playerVillages]
      .slice()
      .sort((a, b) =>
        getStructureName(a.structure, isBlitz).name.localeCompare(getStructureName(b.structure, isBlitz).name),
      );
    return combined;
  }, [playerRealms, playerVillages]);

  return (
    <ModalContainer size="full">
      <ProductionContainer playerStructures={managedStructures} preSelectedResource={preSelectedResource} />
    </ModalContainer>
  );
};
