import { useUIStore } from "@/hooks/store/use-ui-store";
import { ModalContainer } from "@/ui/components/modal-container";
import { LoadingAnimation } from "@/ui/elements/loading-animation";
import { ID, RealmInfo, ResourcesIds } from "@bibliothecadao/types";
import { usePlayerOwnedRealmsInfo, usePlayerOwnedVillagesInfo } from "@bibliothecadao/react";
import { Suspense, lazy, useCallback, useMemo, useState } from "react";

const ProductionSidebar = lazy(() =>
  import("./production-sidebar").then((module) => ({ default: module.ProductionSidebar })),
);

const ProductionBody = lazy(() => import("./production-body").then((module) => ({ default: module.ProductionBody })));

const ProductionContainer = ({
  playerRealmsAndVillages,
  preSelectedResource,
}: {
  playerRealmsAndVillages: RealmInfo[];
  preSelectedResource?: ResourcesIds;
}) => {
  const initialRealm = useMemo(() => {
    const structureEntityId = useUIStore.getState().structureEntityId;
    const selectedRealm = playerRealmsAndVillages.find((r) => r.entityId === structureEntityId);
    return selectedRealm;
  }, [playerRealmsAndVillages]);

  const [selectedRealm, setSelectedRealm] = useState<RealmInfo | undefined>(initialRealm || playerRealmsAndVillages[0]);

  const handleSelectRealm = useCallback(
    (id: ID) => {
      const realm = playerRealmsAndVillages.find((r) => r.entityId === id);
      setSelectedRealm(realm);
    },
    [playerRealmsAndVillages],
  );

  return (
    <div className="production-modal-selector container border mx-auto grid grid-cols-12 bg-dark-wood border-gold/30 h-full row-span-12 rounded-2xl relative panel-wood">
      <div className="col-span-3 p-1 pb-36 row-span-10 overflow-y-auto panel-wood-right">
        <Suspense fallback={<LoadingAnimation />}>
          {playerRealmsAndVillages.length > 0 && (
            <ProductionSidebar
              realms={playerRealmsAndVillages}
              selectedRealmEntityId={selectedRealm?.entityId || 0}
              onSelectRealm={handleSelectRealm}
            />
          )}
        </Suspense>
      </div>
      <div className="col-span-9 h-full row-span-10 overflow-y-auto p-4 pb-36">
        <Suspense fallback={<LoadingAnimation />}>
          {selectedRealm && <ProductionBody realm={selectedRealm} preSelectedResource={preSelectedResource} />}
        </Suspense>
      </div>
    </div>
  );
};

export const ProductionModal = ({ preSelectedResource }: { preSelectedResource?: ResourcesIds }) => {
  const playerRealms = usePlayerOwnedRealmsInfo();
  const playerVillages = usePlayerOwnedVillagesInfo();

  const playerRealmsAndVillages = useMemo(() => {
    return [...playerRealms, ...playerVillages];
  }, [playerRealms, playerVillages]);

  return (
    <ModalContainer size="full">
      <ProductionContainer
        playerRealmsAndVillages={playerRealmsAndVillages}
        preSelectedResource={preSelectedResource}
      />
    </ModalContainer>
  );
};
