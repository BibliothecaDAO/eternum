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
      <div className="production-modal-selector container border mx-auto bg-dark border-gold/30 h-full rounded-2xl relative">
        <div className="h-full col-span-12 w-full overflow-y-auto max-h-[calc(50vh-80px)]">
          <Suspense fallback={<LoadingAnimation />}>
            <CombatContainer attackerEntityId={attackerEntityId} targetHex={targetHex} />
          </Suspense>
        </div>
      </div>
    </ModalContainer>
  );
};
