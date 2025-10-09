import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { ModalContainer } from "@/ui/shared";
import { usePlayerOwnedRealmsInfo, usePlayerOwnedVillagesInfo } from "@bibliothecadao/react";
import { ID, RealmInfo, ResourcesIds } from "@bibliothecadao/types";
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";

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
  const initialRealm = useMemo(() => {
    const structureEntityId = useUIStore.getState().structureEntityId;
    const selectedRealm = playerStructures.find((structure) => structure.entityId === structureEntityId);
    return selectedRealm;
  }, [playerStructures]);

  const [selectedRealm, setSelectedRealm] = useState<RealmInfo | undefined>(initialRealm || playerStructures[0]);
  const [selectedResource, setSelectedResource] = useState<ResourcesIds | null>(preSelectedResource ?? null);

  useEffect(() => {
    if (preSelectedResource === undefined) return;
    setSelectedResource(preSelectedResource ?? null);
  }, [preSelectedResource]);

  const handleSelectRealm = useCallback(
    (id: ID) => {
      const realm = playerStructures.find((structure) => structure.entityId === id);
      console.log("[ProductionModal] handleSelectRealm", {
        selectedEntityId: id,
        matchFound: Boolean(realm),
      });
      setSelectedRealm(realm);
      setSelectedResource(null);
    },
    [playerStructures],
  );

  const handleManageResource = useCallback(
    (realmId: ID, resource: ResourcesIds) => {
      const realm = playerStructures.find((structure) => structure.entityId === realmId) || selectedRealm;
      console.log("[ProductionModal] handleManageResource", {
        realmId,
        resource,
        matchFound: Boolean(realm),
      });
      if (realm) {
        setSelectedRealm(realm);
        setSelectedResource(resource);
      }
    },
    [playerStructures, selectedRealm],
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
    const combined = [...playerRealms, ...playerVillages];
    console.log("[ProductionModal] managedStructures memo", {
      realmCount: playerRealms.length,
      villageCount: playerVillages.length,
      total: combined.length,
    });
    return combined;
  }, [playerRealms, playerVillages]);

  return (
    <ModalContainer size="full">
      <ProductionContainer
        playerStructures={managedStructures}
        preSelectedResource={preSelectedResource}
      />
    </ModalContainer>
  );
};
