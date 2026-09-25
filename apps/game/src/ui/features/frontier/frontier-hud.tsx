import { useUIStore } from "@/hooks/store/use-ui-store";
import { QuickFeed } from "@/ui/features/event-feed/quick-feed";
import { HudChatWindow } from "@/ui/features/world/containers/hud-chat-window";
import { type CSSProperties, useEffect, useState } from "react";
import { FrontierPick } from "./attributes/frontier-pick";
import { FrontierArmyDock } from "./frontier-army-dock";
import { useExpeditionRules, useFrontierRealm } from "./frontier-home";
import { FrontierSelectionSheet } from "./frontier-selection-sheet";
import { FrontierStatusStrip } from "./frontier-status-strip";
import { FrontierGuide, useGuideLine } from "./guide/frontier-guide";
import { useFrontierType } from "./use-frontier-type";

const SAFE_AREA: CSSProperties = {
  paddingTop: "max(env(safe-area-inset-top), 0.5rem)",
  paddingRight: "max(env(safe-area-inset-right), 0.5rem)",
  paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)",
  paddingLeft: "max(env(safe-area-inset-left), 0.5rem)",
};

/**
 * Frontier's own HUD, one tree for every width. Upright phones stack the status strip, the map, the selection sheet,
 * the chat strip and the army dock; sideways and on desktop the dock and chat move to the left edge and the sheet to
 * the right. Everything else opens from these: the muster and build surfaces, settings, the log.
 */
export const FrontierHud = ({ rules }: { rules: NonNullable<ReturnType<typeof useExpeditionRules>> }) => {
  useFrontierType();
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const realm = useFrontierRealm();
  const [logOpen, setLogOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const armySelected = useUIStore((state) => state.entityActions.selectedEntityId !== null);
  const guideLine = useGuideLine(rules, realm);
  // Picking an army is the moment to play, not to read: chat folds away.
  useEffect(() => {
    if (armySelected) setChatOpen(false);
  }, [armySelected]);
  if (showBlankOverlay) return null;

  return (
    <div
      aria-label="Frontier HUD"
      // The session happens on the map: while the selection sheet shows something, Ysolde waits out of the way (her
      // line stays unseen) instead of stacking on it, by the same test the sheet uses to show itself.
      className="pointer-events-none fixed inset-0 z-30 flex flex-col gap-2 [&:has([data-selection-sheet]_[data-sheet-content]>*)_[data-guide]]:hidden"
      style={SAFE_AREA}
    >
      <FrontierStatusStrip rules={rules} realm={realm} />
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 landscape:flex-row landscape:items-stretch landscape:justify-between">
        <div className="flex max-w-[min(360px,70vw)] flex-col items-end gap-1 self-end portrait:mb-auto landscape:order-2 landscape:mb-auto landscape:ml-auto landscape:self-start">
          <QuickFeed logOpen={logOpen} onLogToggle={() => setLogOpen((open) => !open)} />
        </div>
        <FrontierSelectionSheet />
        {/* The dock, chat and guide keep their height; the selection sheet above scrolls to make room. */}
        <div className="flex min-h-0 shrink-0 flex-col-reverse gap-2 landscape:order-first landscape:w-48 landscape:flex-col">
          {realm && <FrontierArmyDock realm={realm} />}
          {/* The pick deals into the thumb zone above the dock on an upright phone, and floats at the foot otherwise. */}
          <div className="landscape:fixed landscape:bottom-4 landscape:left-1/2 landscape:w-[min(560px,60vw)] landscape:-translate-x-1/2">
            <FrontierPick />
          </div>
          <HudChatWindow open={chatOpen} onOpenChange={setChatOpen} foldToIcon={guideLine.step !== null} />
          {/* Ysolde sits above chat on a phone held upright, and floats at the foot of the screen otherwise. While she
              has a line, chat folds to its icon on an upright phone. */}
          <div
            data-guide
            className="landscape:fixed landscape:bottom-4 landscape:left-1/2 landscape:w-[min(440px,48vw)] landscape:-translate-x-1/2"
          >
            {realm && <FrontierGuide line={guideLine} realm={realm} />}
          </div>
        </div>
      </div>
    </div>
  );
};
