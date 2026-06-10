import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { CenteredModalShell } from "@/ui/features/world/containers/centered-modal-shell";
import { ActorType, ID } from "@bibliothecadao/types";
import ArrowLeftRight from "lucide-react/dist/esm/icons/arrow-left-right";
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
    <CenteredModalShell
      title="Transfer Troops & Relics"
      icon={ArrowLeftRight}
      onClose={() => toggleModal(null)}
      size="wide"
      bodyClassName="overflow-y-auto"
    >
      <div className="p-4">
        <Suspense fallback={<LoadingAnimation />}>
          <HelpContainer selected={selected} target={target} allowBothDirections={allowBothDirections} />
        </Suspense>
      </div>
    </CenteredModalShell>
  );
};
