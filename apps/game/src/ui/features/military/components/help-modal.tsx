import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { HudWindow } from "@/ui/design-system/kit/hud-elements";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
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
  const closeSurface = usePopoverStore((state) => state.closeSurface);

  return (
    <HudWindow title="Transfer Troops & Relics" icon="swap" size="page" onClose={closeSurface}>
      <Suspense fallback={<LoadingAnimation />}>
        <HelpContainer selected={selected} target={target} allowBothDirections={allowBothDirections} />
      </Suspense>
    </HudWindow>
  );
};
