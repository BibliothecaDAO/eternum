import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { PlayerRelicTray } from "@/ui/features/relics/components/player-relic-tray";
import { SelectedWorldmapEntity } from "@/ui/features/world/components/actions/selected-worldmap-entity";
import { MiniMapNavigation } from "@/ui/features/world/containers/mini-map-navigation";
import { useQuery } from "@bibliothecadao/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { CSSProperties, ReactNode } from "react";

import { BottomHudShell, HudPanel } from "./";

interface HudSlotProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const HudSlot = ({ children, className, style }: HudSlotProps) => (
  <div className={cn("flex h-full min-h-0 flex-1 flex-col gap-3 overflow-auto", className)} style={style}>
    {children}
  </div>
);

export const BottomHud = () => {
  const { isMapView } = useQuery();
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const isMinimized = useUIStore((state) => state.isBottomHudMinimized);
  const setIsBottomHudMinimized = useUIStore((state) => state.setIsBottomHudMinimized);

  if (!isMapView || showBlankOverlay) {
    return null;
  }

  const expandedHeight = "h-[20vh] min-h-[20vh] max-h-[20vh]";
  const minimizedHeight = "h-[40px] min-h-[40px] max-h-[40px]";
  const shellClassName = cn(isMinimized ? minimizedHeight : expandedHeight, isMinimized ? "gap-0 pt-0" : "gap-3 pt-4");

  const toggleMinimize = () => {
    setIsBottomHudMinimized(!isMinimized);
  };

  return (
    <BottomHudShell className={shellClassName}>
      <button
        onClick={toggleMinimize}
        className="pointer-events-auto absolute -top-0 right-4 flex items-center justify-center rounded-lg bg-brown/80 px-3 py-1 transition-colors hover:bg-brown/90 border border-gold/20"
        aria-label={isMinimized ? "Maximize HUD" : "Minimize HUD"}
      >
        {isMinimized ? (
          <ChevronUp className="h-4 w-4 text-gold/70" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gold/70" />
        )}
      </button>
      <div
        className={cn("flex h-full min-h-0 w-full flex-1 items-stretch gap-3 overflow-hidden", isMinimized && "hidden")}
      >
        <HudSlot className="min-w-0" style={{ flex: "0.5 0.5 0%", minWidth: "140px" }}>
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
