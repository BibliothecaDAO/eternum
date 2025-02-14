import { ModalContainer } from "@/ui/components/modal-container";
import { LoadingAnimation } from "@/ui/elements/loading-animation";
import { ID } from "@bibliothecadao/eternum";
import { Suspense } from "react";
import { CombatContainer } from "./combat-container";

export const CombatModal = ({
  attackerEntityId,
  targetHex,
}: {
  attackerEntityId: ID;
  targetHex: { x: number; y: number };
}) => {
  return (
    <ModalContainer size="half">
      <div className="production-modal-selector container border mx-auto grid grid-cols-12 bg-dark border-gold/30 h-full row-span-12 rounded-2xl relative">
        <div className="col-span-9 h-full row-span-10 overflow-y-auto p-4 pb-36">
          <h2 className="text-4xl font-bold mb-6">Battle</h2>
          <Suspense fallback={<LoadingAnimation />}>
            <CombatContainer attackerEntityId={attackerEntityId} targetHex={targetHex} />
          </Suspense>
        </div>
      </div>
    </ModalContainer>
  );
};
