import { MiniMapNavigation } from "@/ui/features/world/containers/mini-map-navigation";
import { SelectedWorldmapEntity } from "@/ui/features/world/components/actions/selected-worldmap-entity";
import { PlayerRelicTray } from "@/ui/features/relics/components/player-relic-tray";
import { RealtimeChatShell } from "@/ui/features/social/realtime-chat/ui/realtime-chat-shell";
import { Compass, Gem, Map as MapIcon, MessageSquare } from "lucide-react";
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
  return (
    <BottomHudShell>
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
    </BottomHudShell>
  );
};
