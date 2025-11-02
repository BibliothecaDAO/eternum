import { useUIStore } from "@/hooks/store/use-ui-store";
import { PlayerRelicTray } from "@/ui/features/relics/components/player-relic-tray";
import { RealtimeChatShell } from "@/ui/features/social/realtime-chat/ui/realtime-chat-shell";
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
  <div className={`flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden ${className ?? ""}`}>{children}</div>
);

export const BottomHud = () => {
  const { isMapView } = useQuery();
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const isMinimized = useUIStore((state) => state.isBottomHudMinimized);
  const toggleMinimized = useUIStore((state) => state.toggleBottomHudMinimized);

  if (!isMapView || showBlankOverlay) {
    return null;
  }

  return (
    <BottomHudShell className={isMinimized ? "gap-2 py-3" : undefined}>
      {/* <div className="flex w-full items-center justify-end">
        <button
          type="button"
          onClick={toggleMinimized}
          aria-expanded={!isMinimized}
          aria-label={isMinimized ? "Expand bottom HUD" : "Collapse bottom HUD"}
          className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white/70 transition hover:border-white/20 hover:bg-black/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
        >
          <span className="sr-only">{isMinimized ? "Show HUD" : "Hide HUD"}</span>
          {isMinimized ? <ChevronUp size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />}
        </button>
      </div> */}

      {!isMinimized && (
        <div className="flex min-h-0 w-full flex-1 items-stretch gap-3 overflow-hidden">
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
            <HudPanel className="flex-[0.38] min-h-0">
              <PlayerRelicTray variant="embedded" className="h-full" />
            </HudPanel>
            <HudPanel className="flex-[0.62] min-h-0">
              <RealtimeChatShell displayMode="embedded" className="h-full" />
            </HudPanel>
          </HudSlot>
        </div>
      )}
    </BottomHudShell>
  );
};
