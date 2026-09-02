import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { SurfaceFrame } from "@/ui/design-system/molecules/popover";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
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
  const closeSurface = usePopoverStore((state) => state.closeSurface);

  return (
    <SurfaceFrame
      title="Transfer Troops & Relics"
      icon={ArrowLeftRight}
      onClose={closeSurface}
      className="w-[920px] max-h-[calc(100vh-7rem)]"
      bodyClassName="overflow-y-auto"
    >
      <div className="p-4">
        <Suspense fallback={<LoadingAnimation />}>
          <HelpContainer selected={selected} target={target} allowBothDirections={allowBothDirections} />
        </Suspense>
      </div>
    </SurfaceFrame>
  );
};
