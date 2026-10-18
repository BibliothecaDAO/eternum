import { HudButton, HudNotice } from "@/ui/design-system/kit/hud-elements";
import { TRY_AGAIN } from "@/ui/design-system/kit/words";

/** Something the game could not do, above the foot rows, in the bad tone, with Try again beside it. */
export const RetryNotice = ({ line, onRetry }: { line: string; onRetry: () => void }) => (
  <div className="pointer-events-auto flex items-center gap-2">
    <span className="min-w-0 flex-1">
      <HudNotice tone="bad" line={line} />
    </span>
    <HudButton kind="secondary" size="sm" onClick={onRetry}>
      {TRY_AGAIN}
    </HudButton>
  </div>
);
