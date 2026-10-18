import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ReactNode } from "react";

type TabCueTone = "default" | "success" | "warning" | "danger" | "muted";
type EntityBannerRelicCueState = "empty" | "stored" | "usable";

interface EntityBannerSplitCue {
  primary: ReactNode;
  secondary: ReactNode;
  state: Exclude<EntityBannerRelicCueState, "empty">;
}

interface EntityBannerRelicCue {
  state: EntityBannerRelicCueState;
  disabled: boolean;
  splitCue?: EntityBannerSplitCue;
}

interface EntityBannerTabCueProps {
  icon: IconMeaning;
  label: string;
  cue?: ReactNode;
  splitCue?: EntityBannerSplitCue;
  tone?: TabCueTone;
}

const cueToneClass: Record<TabCueTone, string> = {
  default: "border-hud-line bg-hud-well text-hud-ink",
  success: "border-emerald-400/45 bg-emerald-400/15 text-hud-good",
  warning: "border-amber-300/55 bg-amber-400/15 text-hud-warn",
  danger: "border-red-400/55 bg-red-500/15 text-hud-bad",
  muted: "border-hud-divider bg-hud-well text-hud-muted",
};

export const resolveEntityBannerRelicCue = (usableRelics: number, totalRelics: number): EntityBannerRelicCue => {
  const usableCount = Math.max(0, Math.floor(usableRelics));
  const totalCount = Math.max(0, Math.floor(totalRelics));

  if (totalCount === 0) {
    return { state: "empty", disabled: true };
  }

  const state = usableCount > 0 ? "usable" : "stored";

  return {
    state,
    disabled: false,
    splitCue: {
      primary: usableCount,
      secondary: totalCount,
      state,
    },
  };
};

const EntityBannerTabCue = ({ icon: Icon, label, cue, splitCue, tone = "default" }: EntityBannerTabCueProps) => {
  return (
    <span className="relative flex h-8 min-w-0 items-center justify-center">
      <SemanticIcon name={Icon} className="h-4 w-4 text-hud-ink" />
      <span className="sr-only">{label}</span>
      {splitCue ? (
        <span
          className={cn(
            "absolute -right-4 -top-2 inline-flex min-w-7 items-baseline justify-center rounded-full border bg-hud-well px-1.5 text-center text-hud-label leading-4 shadow-[0_0_10px_rgba(0,0,0,0.45)]",
            "border-hud-line text-hud-muted",
          )}
        >
          <span className="font-bold text-hud-ink">{splitCue.primary}</span>
          <span className="font-semibold text-hud-muted">/{splitCue.secondary}</span>
        </span>
      ) : null}
      {!splitCue && cue !== undefined && cue !== null && (
        <span
          className={cn(
            "absolute -right-3 -top-2 min-w-5 whitespace-nowrap rounded-full border px-1 text-center text-hud-label leading-4 shadow-[0_0_10px_rgba(0,0,0,0.45)]",
            cueToneClass[tone],
          )}
        >
          {cue}
        </span>
      )}
    </span>
  );
};
