import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatTime } from "@bibliothecadao/eternum";

/** The red "rebuilding" badge on a wiped guard slot: the delay left before it accepts troops again. */
export const GuardCooldownBadge = ({ seconds, className }: { seconds: number; className?: string }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded border border-hud-bad bg-danger/15 px-1.5 py-0.5 text-hud-label uppercase tracking-wide text-hud-bad",
      className,
    )}
    title="This slot was wiped out and is still rebuilding"
  >
    <SemanticIcon name="hourglass" className="h-3 w-3" />
    {formatTime(seconds)}
  </span>
);
