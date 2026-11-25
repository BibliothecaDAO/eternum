import { HudChip } from "@/ui/design-system/kit/hud-elements";
import { GUARD_WORDS } from "@/ui/design-system/kit/words";
import { formatWait } from "@bibliothecadao/types";

/** The "rebuilding" chip on a wiped guard slot, in the bad tone: the delay left before it accepts troops again. */
export const GuardCooldownBadge = ({ seconds }: { seconds: number }) => (
  <span title={GUARD_WORDS.rebuilding}>
    <HudChip tone="bad">{formatWait(seconds)}</HudChip>
  </span>
);
