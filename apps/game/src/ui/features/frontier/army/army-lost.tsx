import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudSheet } from "@/ui/design-system/kit/hud-elements";
import { FIGHT_WORDS } from "@/ui/design-system/kit/words";
import { useEffect, useRef } from "react";

/** How long the loss stands in the panel before it closes by itself: long enough to read its two lines. */
export const ARMY_LOST_MS = 3_000;

/**
 * An attack that cost the army its life, told where the army's panel would have opened (owner, 30 October 2026: "the
 * panel shows the outcome and closes, no panel for a gone army"): its loss and what to do next, then the panel closes by
 * itself. Its × closes it sooner, and a new pick on the map replaces it as any panel. The Feed keeps the fight's line.
 */
export const ArmyLostSheet = ({ onClose }: { onClose: () => void }) => {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const closes = setTimeout(() => close.current(), ARMY_LOST_MS);
    return () => clearTimeout(closes);
  }, []);
  return (
    <HudSheet label={FIGHT_WORDS.armyLost} onClose={onClose}>
      <p className="flex items-center gap-3 text-hud-body text-hud-ink" role="status">
        <SemanticIcon name="skull" size={48} />
        {FIGHT_WORDS.armyLostNext}
      </p>
    </HudSheet>
  );
};
