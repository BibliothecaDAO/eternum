import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { ModalContainer } from "@/ui/shared";
import { ActorType, ID } from "@bibliothecadao/types";
import { Suspense } from "react";
import { ChestContainer } from "./chest-container";

export const ChestModal = ({
  selected,
  chestHex,
}: {
  selected: {
    type: ActorType;
    id: ID;
    hex: { x: number; y: number };
  };
  chestHex: { x: number; y: number };
}) => {
  return (
    <ModalContainer size="large">
      <div className="production-modal-selector container mx-auto h-full rounded-2xl relative flex flex-col">
        {/* Header */}
        <div className="flex justify-center border-b border-gold/30">
          <div className="px-6 py-3 text-lg font-semibold text-gold">Open Relic Crate</div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-200px)]">
          <Suspense fallback={<LoadingAnimation />}>
            <ChestContainer explorerEntityId={selected.id} chestHex={chestHex} />
          </Suspense>
        </div>
      </div>
    </ModalContainer>
  );
};
