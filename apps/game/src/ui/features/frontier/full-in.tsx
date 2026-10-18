import { HudChip } from "@/ui/design-system/kit/hud-elements";
import { formatDuration } from "@/ui/design-system/kit/time";
import { FULL_IN } from "@/ui/design-system/kit/words";

/** How long until a store or a stamina bar is full: "Full in 3h 10m", never days. */
export const FullIn = ({ seconds }: { seconds: number | undefined }) => (
  <HudChip>
    {FULL_IN} {formatDuration(seconds)}
  </HudChip>
);
