import { useUIStore } from "@/hooks/store/use-ui-store";
import { QuickFeed } from "@/ui/features/event-feed/quick-feed";
import { type CSSProperties, useState } from "react";
import { FrontierArmyDock } from "./frontier-army-dock";
import { useExpeditionRules, useFrontierRealm } from "./frontier-home";
import { FrontierSelectionSheet } from "./frontier-selection-sheet";
import { FrontierStatusStrip } from "./frontier-status-strip";

const SAFE_AREA: CSSProperties = {
  paddingTop: "max(env(safe-area-inset-top), 0.5rem)",
  paddingRight: "max(env(safe-area-inset-right), 0.5rem)",
  paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)",
  paddingLeft: "max(env(safe-area-inset-left), 0.5rem)",
};

/**
 * Frontier's own HUD, one tree for every width. Upright phones stack the status strip, the map, the selection sheet
 * and the army dock; sideways and on desktop the dock moves to the left edge and the sheet to the right. Everything
 * else opens from these: the muster and build surfaces, settings, the log.
 */
export const FrontierHud = ({ rules }: { rules: NonNullable<ReturnType<typeof useExpeditionRules>> }) => {
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const realm = useFrontierRealm();
  const [logOpen, setLogOpen] = useState(false);
  if (showBlankOverlay) return null;

  return (
    <div
      aria-label="Frontier HUD"
      className="pointer-events-none fixed inset-0 z-30 flex flex-col gap-2"
      style={SAFE_AREA}
    >
      <FrontierStatusStrip rules={rules} realm={realm} />
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 landscape:flex-row landscape:items-stretch landscape:justify-between">
        <div className="flex max-w-[min(360px,70vw)] flex-col items-end gap-1 self-end portrait:mb-auto landscape:order-2 landscape:mb-auto landscape:ml-auto landscape:self-start">
          <QuickFeed logOpen={logOpen} onLogToggle={() => setLogOpen((open) => !open)} />
        </div>
        <FrontierSelectionSheet />
        {realm && (
          <div className="min-h-0 landscape:order-first">
            <FrontierArmyDock realm={realm} />
          </div>
        )}
      </div>
    </div>
  );
};
