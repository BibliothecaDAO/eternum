import { ModalContainer } from "@/ui/components/modal-container";
import { LoadingAnimation } from "@/ui/elements/loading-animation";
import { ID } from "@bibliothecadao/types";
import { Suspense } from "react";
import { HelpContainer } from "./help-container";

export const HelpModal = ({
  selectedEntityId,
  targetHex,
}: {
  selectedEntityId: ID;
  targetHex: { x: number; y: number };
}) => {
  return (
    <ModalContainer size="large">
      <div className="production-modal-selector container border mx-auto grid grid-cols-12 bg-dark border-gold/30 h-full row-span-12 rounded-2xl relative">
        <div className="h-full col-span-12 overflow-y-auto">
          <Suspense fallback={<LoadingAnimation />}>
            <HelpContainer selectedEntityId={selectedEntityId} targetHex={targetHex} />
          </Suspense>
        </div>
      </div>
    </ModalContainer>
  );
};
