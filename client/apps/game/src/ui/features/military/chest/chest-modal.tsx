import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { ModalContainer } from "@/ui/shared";
import { DEFAULT_COORD_ALT } from "@bibliothecadao/eternum";
import { ActorType, ID } from "@bibliothecadao/types";
import { Suspense } from "react";
import { ChestContainer } from "./chest-container";

export const ChestModal = ({
  selected,
  chestHex,
  chestAlt = DEFAULT_COORD_ALT,
}: {
  selected: {
    type: ActorType;
    id: ID;
    hex: { x: number; y: number };
  };
  chestHex: { x: number; y: number };
  chestAlt?: boolean;
}) => {
  return (
    <ModalContainer size="large">
      <div className="production-modal-selector container mx-auto h-full rounded-2xl relative flex flex-col">
        {/* Header */}
        <div className="flex justify-center border-b border-gold/30">
          <div className="px-6 py-3 text-lg font-semibold text-gold bg-gradient-to-r from-gold/80 via-gold to-gold/80 bg-clip-text text-transparent">
            ✨ Open Relic Crate ✨
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-200px)]">
          <Suspense fallback={<LoadingAnimation />}>
            <ChestContainer explorerEntityId={selected.id} chestHex={chestHex} chestAlt={chestAlt} />
          </Suspense>
        </div>
      </div>
    </ModalContainer>
  );
};
