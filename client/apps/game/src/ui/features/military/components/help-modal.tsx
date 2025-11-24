import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { SecondaryPopup } from "@/ui/design-system/molecules/secondary-popup";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ActorType, ID } from "@bibliothecadao/types";
import { Suspense } from "react";
import { HelpContainer } from "./help-container";

export const HelpModal = ({
  selected,
  target,
  allowBothDirections = false,
}: {
  selected: {
    type: ActorType;
    id: ID;
    hex: { x: number; y: number };
  };
  target: {
    type: ActorType;
    id: ID;
    hex: { x: number; y: number };
  };
  allowBothDirections?: boolean;
}) => {
  const toggleModal = useUIStore((state) => state.toggleModal);

  return (
    <SecondaryPopup width="960" name="transfer-modal" containerClassName="absolute left-0 top-0">
      <SecondaryPopup.Head onClose={() => toggleModal(null)}>Transfer Troops & Relics</SecondaryPopup.Head>
      <SecondaryPopup.Body width="100%" height="auto">
        <div className="p-4">
          <Suspense fallback={<LoadingAnimation />}>
            <HelpContainer selected={selected} target={target} allowBothDirections={allowBothDirections} />
          </Suspense>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
