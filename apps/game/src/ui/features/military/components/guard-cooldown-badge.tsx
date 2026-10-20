import { HudChip } from "@/ui/design-system/kit/hud-elements";
import { formatWait } from "@bibliothecadao/types";

/** The "rebuilding" chip on a wiped guard slot, in the bad tone: the delay left before it accepts troops again. */
export const GuardCooldownBadge = ({ seconds }: { seconds: number }) => (
  <span title="This slot was wiped out and is still rebuilding">
    <HudChip tone="bad">{formatWait(seconds)}</HudChip>
  </span>
);
