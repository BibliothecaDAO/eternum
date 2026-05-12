import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ElementType, ReactNode } from "react";

type TabCueTone = "default" | "success" | "warning" | "danger" | "muted";

interface EntityBannerTabCueProps {
  icon: ElementType<{ className?: string }>;
  label: string;
  cue?: ReactNode;
  tone?: TabCueTone;
}

const cueToneClass: Record<TabCueTone, string> = {
  default: "border-gold/35 bg-black/70 text-gold",
  success: "border-emerald-400/45 bg-emerald-400/15 text-emerald-200",
  warning: "border-amber-300/55 bg-amber-400/15 text-amber-100",
  danger: "border-red-400/55 bg-red-500/15 text-red-100",
  muted: "border-gold/20 bg-black/50 text-gold/55",
};

export const EntityBannerTabCue = ({ icon: Icon, label, cue, tone = "default" }: EntityBannerTabCueProps) => (
  <span className="relative flex h-8 min-w-0 items-center justify-center">
    <Icon className="h-4 w-4 text-gold" />
    <span className="sr-only">{label}</span>
    {cue !== undefined && cue !== null && (
      <span
        className={cn(
          "absolute -right-3 -top-2 min-w-5 rounded-full border px-1 text-center text-[9px] font-semibold leading-4 shadow-[0_0_10px_rgba(0,0,0,0.45)]",
          cueToneClass[tone],
        )}
      >
        {cue}
      </span>
    )}
  </span>
);
