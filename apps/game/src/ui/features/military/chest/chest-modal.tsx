import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { SurfaceFrame } from "@/ui/design-system/molecules/popover";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { ActorType, ID } from "@bibliothecadao/types";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { Suspense, useCallback } from "react";
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
  const closeSurface = usePopoverStore((state) => state.closeSurface);
  const close = useCallback(() => closeSurface(), [closeSurface]);

  return (
    <SurfaceFrame
      title="Open Relic Crate"
      icon={Sparkles}
      onClose={close}
      className="w-[1320px] h-[calc(100vh-7rem)]"
      bodyClassName="overflow-y-auto overflow-x-hidden"
    >
      <Suspense fallback={<LoadingAnimation />}>
        <ChestContainer explorerEntityId={selected.id} chestHex={chestHex} />
      </Suspense>
    </SurfaceFrame>
  );
};
