import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatTime } from "@bibliothecadao/eternum";
import Timer from "lucide-react/dist/esm/icons/timer";

/** The red "rebuilding" badge on a wiped guard slot: the delay left before it accepts troops again. */
export const GuardCooldownBadge = ({ seconds, className }: { seconds: number; className?: string }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded border border-danger/60 bg-danger/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger",
      className,
    )}
    title="This slot was wiped out and is still rebuilding"
  >
    <Timer className="h-3 w-3" />
    {formatTime(seconds)}
  </span>
);
