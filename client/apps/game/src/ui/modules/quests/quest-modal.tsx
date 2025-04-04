import { ModalContainer } from "@/ui/components/modal-container";
import { LoadingAnimation } from "@/ui/elements/loading-animation";
import { ID } from "@bibliothecadao/eternum";
import { Suspense } from "react";
import { QuestContainer } from "./quest-container";

export const QuestModal = ({
  explorerEntityId,
  targetHex,
}: {
  explorerEntityId: ID;
  targetHex: { x: number; y: number };
}) => {
  return (
    <ModalContainer size="large">
      <div className="container mx-auto h-full rounded-2xl relative flex flex-col">
        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-200px)]">
          <Suspense fallback={<LoadingAnimation />}>
            <QuestContainer explorerEntityId={explorerEntityId} targetHex={targetHex} />
          </Suspense>
        </div>
      </div>
    </ModalContainer>
  );
};
