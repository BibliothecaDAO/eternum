import { useUIStore } from "@/hooks/store/use-ui-store";
import { ModalContainer } from "@/ui/components/modal-container";
import { LoadingAnimation } from "@/ui/elements/loading-animation";
import { ID, RealmInfo } from "@bibliothecadao/eternum";
import { usePlayerOwnedRealms } from "@bibliothecadao/react";
import { Suspense, lazy, useCallback, useMemo, useState } from "react";

const ProductionSidebar = lazy(() =>
  import("./production-sidebar").then((module) => ({ default: module.ProductionSidebar })),
);

const ProductionBody = lazy(() => import("./production-body").then((module) => ({ default: module.ProductionBody })));

export const ProductionModal = () => {
  const playerRealms = usePlayerOwnedRealms();

  const initialRealm = useMemo(() => {
    const structureEntityId = useUIStore.getState().structureEntityId;
    const selectedRealm = playerRealms.find((r) => r.entityId === structureEntityId);
    return selectedRealm;
  }, [playerRealms]);

  const [selectedRealm, setSelectedRealm] = useState<RealmInfo | undefined>(initialRealm || playerRealms[0]);

  const handleSelectRealm = useCallback(
    (id: ID) => {
      const realm = playerRealms.find((r) => r.entityId === id);
      setSelectedRealm(realm);
    },
    [playerRealms],
  );

  return (
    <ModalContainer size="full">
      <div className="production-modal-selector container border mx-auto grid grid-cols-12 bg-dark border-gold/30 h-full row-span-12 rounded-2xl relative">
        <div className="col-span-3 p-1 pb-36 row-span-10 overflow-y-auto border-r border-gold/30">
          <Suspense fallback={<LoadingAnimation />}>
            {playerRealms.length > 0 && (
              <ProductionSidebar
                realms={playerRealms}
                selectedRealmEntityId={selectedRealm?.entityId || 0}
                onSelectRealm={handleSelectRealm}
              />
            )}
          </Suspense>
        </div>
        <div className="col-span-9 h-full row-span-10 overflow-y-auto p-4 pb-36">
          <h2 className="text-4xl font-bold mb-6">Production</h2>
          <Suspense fallback={<LoadingAnimation />}>
            {selectedRealm && <ProductionBody realm={selectedRealm} />}
          </Suspense>
        </div>
      </div>
    </ModalContainer>
  );
};
