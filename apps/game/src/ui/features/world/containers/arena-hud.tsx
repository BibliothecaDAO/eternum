import { useState } from "react";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { ArenaHudView } from "./arena-hud-view";
import { StructureListColumn } from "./left-facets/structure-list-column";
import { EmpireCockpit } from "./left-facets/empire-cockpit";
import { StructureActionsPanel } from "./left-facets/structure-actions-panel";
import { NextSuggestion } from "./left-facets/next-suggestion";
import { TopHeader } from "./top-header/top-header";
import { SpectatorStandings } from "./spectator-standings";
import { MinimapPanel } from "../components/bottom-right-panel/bottom-right-panel";
import { SelectedTileSummary } from "./selected-tile-summary";
import { HudEvents } from "../../event-feed/hud-events";
import { HudLog } from "../../event-feed/quick-feed";
import { HudChatWindow } from "./hud-chat-window";

export function ArenaHud() {
  const allowed = useUIStore(canIssueOrders);
  const [chatOpen, setChatOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const blank = useUIStore((state) => state.showBlankOverlay);
  if (blank) return null;
  return (
    <ArenaHudView
      header={<TopHeader />}
      structures={allowed ? <StructureListColumn /> : <SpectatorStandings />}
      realm={allowed ? <EmpireCockpit /> : null}
      suggestion={<NextSuggestion />}
      events={<HudEvents />}
      tile={<SelectedTileSummary />}
      minimap={<MinimapPanel />}
      commands={<StructureActionsPanel />}
      chat={
        <div className="hud-chat-host" data-group="Chat">
          <HudChatWindow open={chatOpen} onOpenChange={setChatOpen} foldToIcon />
        </div>
      }
      log={<HudLog open={logOpen} onToggle={() => setLogOpen((value) => !value)} />}
    />
  );
}
