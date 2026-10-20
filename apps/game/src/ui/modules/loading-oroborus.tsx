import { HudLoading, HudPill } from "@/ui/design-system/kit/hud-elements";

/** While the camera moves between the map and a realm: the sheet's loading line in a pill at the screen's foot. */
export const LoadingOroborus = ({ loading }: { loading: boolean }) => {
  if (!loading) return null;
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-hud-loading -translate-x-1/2">
      <HudPill>{[<HudLoading key="line" line="Changing view…" />]}</HudPill>
    </div>
  );
};
