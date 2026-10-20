import { useUIStore } from "@/hooks/store/use-ui-store";
import { HudSheet } from "@/ui/design-system/kit/hud-elements";
import { SpireDepthActions } from "./spire-depth-actions";

/** The spire's sheet for the army standing at it: the depths it can travel to. Closing it lets go of the army too. */
export const FrontierSpireSheet = ({ armyEntityId, onClose }: { armyEntityId: number; onClose: () => void }) => (
  <HudSheet
    label="Spire"
    onClose={() => {
      useUIStore.getState().deselectEntity();
      onClose();
    }}
  >
    <SpireDepthActions armyEntityId={armyEntityId} />
  </HudSheet>
);
