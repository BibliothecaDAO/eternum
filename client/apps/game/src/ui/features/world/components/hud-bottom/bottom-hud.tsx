import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { PlayerRelicTray } from "@/ui/features/relics/components/player-relic-tray";
import { SelectedWorldmapEntity } from "@/ui/features/world/components/actions/selected-worldmap-entity";
import { MiniMapNavigation } from "@/ui/features/world/containers/mini-map-navigation";
import { useQuery } from "@bibliothecadao/react";
import { ReactNode } from "react";

import { BottomHudShell, HudPanel } from "./";

interface HudSlotProps {
  children: ReactNode;
  className?: string;
}

const HudSlot = ({ children, className }: HudSlotProps) => (
  <div className={`flex h-full min-h-0 flex-1 flex-col gap-3 overflow-auto ${className ?? ""}`}>{children}</div>
);

export const BottomHud = () => {
  const { isMapView } = useQuery();
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const isMinimized = useUIStore((state) => state.isBottomHudMinimized);

  if (!isMapView || showBlankOverlay) {
    return null;
  }

  const expandedHeight = "h-[30vh] min-h-[30vh] max-h-[30vh]";
  const minimizedHeight = "h-[180px] min-h-[180px] max-h-[180px]";
  const shellClassName = cn(isMinimized ? minimizedHeight : expandedHeight, isMinimized ? "gap-2 py-3" : "gap-3 py-4");

  return (
    <BottomHudShell className={shellClassName}>
      <div className="flex h-full min-h-0 w-full flex-1 items-stretch gap-3 overflow-hidden">
        <HudSlot className="flex-[1] min-w-[280px]">
          <HudPanel className="flex-1 min-h-0">
            <MiniMapNavigation variant="embedded" className="h-full min-h-0" />
          </HudPanel>
        </HudSlot>

        <HudSlot className="flex-[1.9] min-w-[420px]">
          <HudPanel className="flex-1 min-h-0">
            <SelectedWorldmapEntity />
          </HudPanel>
        </HudSlot>

        <HudSlot className="flex-[1.2] min-w-[320px]">
          <HudPanel className="flex-[0.5] min-h-0">
            <PlayerRelicTray variant="embedded" className="h-full" />
          </HudPanel>
        </HudSlot>
      </div>
    </BottomHudShell>
  );
};
