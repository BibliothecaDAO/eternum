import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import Button from "@/ui/design-system/atoms/button";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import TwitterShareButton from "@/ui/design-system/molecules/twitter-share-button";

import { BattleCooldownTimer } from "../battle-cooldown-timer";
import type { AttackMode } from "./use-battle-lab-state";

interface ActionFooterProps {
  mode: "live" | "sim";
  attackType: AttackMode;
  showRaidToggle: boolean;
  onSetAttackType: (mode: AttackMode) => void;
  isEdited: boolean;
  onResetToLive: () => void;
  actionLabel: string;
  actionDisabled: boolean;
  loading: boolean;
  onAction: () => void;
  warning?: string | null;
  tweet?: string;
  cooldownEnd?: number;
}

export const ActionFooter = ({
  mode,
  attackType,
  showRaidToggle,
  onSetAttackType,
  isEdited,
  onResetToLive,
  actionLabel,
  actionDisabled,
  loading,
  onAction,
  warning,
  tweet,
  cooldownEnd,
}: ActionFooterProps) => {
  return (
    <div className="flex flex-col items-center gap-3">
      {showRaidToggle && (
        <div className="flex overflow-hidden rounded-md border border-hud-line">
          {(["attack", "raid"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onSetAttackType(option)}
              className={cn(
                "px-6 py-1.5 text-hud-strong uppercase tracking-wide transition-colors",
                attackType === option
                  ? "bg-hud-chosen text-hud-accent"
                  : "bg-hud-well text-hud-muted hover:text-hud-accent",
              )}
              aria-pressed={attackType === option}
            >
              {option === "attack" ? "⚔️ Combat" : "💰 Raid"}
            </button>
          ))}
        </div>
      )}

      {mode === "live" && isEdited && (
        <button
          type="button"
          onClick={onResetToLive}
          className="inline-flex items-center gap-1.5 rounded-full border border-hud-line-strong bg-hud-well px-3 py-1 text-hud-label text-hud-accent transition hover:border-hud-line-strong hover:text-hud-accent"
        >
          <SemanticIcon name="refresh" className="h-3 w-3" />
          Reset to live
        </button>
      )}

      {mode === "live" && cooldownEnd !== undefined && cooldownEnd > Math.floor(Date.now() / 1000) && (
        <BattleCooldownTimer cooldownEnd={cooldownEnd} />
      )}

      {mode === "live" && (
        <Button
          variant="primary"
          className="min-w-[200px] px-6 py-3 text-hud-strong"
          isLoading={loading}
          disabled={actionDisabled}
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      )}

      {warning && (
        <div className={cn("text-center text-hud-bad", "text-hud-label text-hud-cue")} role="alert">
          {warning}
        </div>
      )}

      {tweet && <TwitterShareButton text={tweet} callToActionText="Share your Battle" variant="outline" />}
    </div>
  );
};
