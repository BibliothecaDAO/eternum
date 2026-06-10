import Button from "@/ui/design-system/atoms/button";
import { HUD_CUE } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import TwitterShareButton from "@/ui/design-system/molecules/twitter-share-button";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";

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
        <div className="flex overflow-hidden rounded-md border border-gold/30">
          {(["attack", "raid"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onSetAttackType(option)}
              className={cn(
                "px-6 py-1.5 text-sm font-semibold uppercase tracking-wide transition-colors",
                attackType === option ? "bg-gold/20 text-gold" : "bg-black/30 text-gold/60 hover:text-gold",
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
          className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-black/30 px-3 py-1 text-xs font-semibold text-gold/80 transition hover:border-gold hover:text-gold"
        >
          <RotateCcw className="h-3 w-3" />
          Reset to live
        </button>
      )}

      {mode === "live" && cooldownEnd !== undefined && cooldownEnd > Math.floor(Date.now() / 1000) && (
        <BattleCooldownTimer cooldownEnd={cooldownEnd} />
      )}

      {mode === "live" && (
        <Button
          variant="primary"
          className="min-w-[200px] px-6 py-3 text-base font-bold"
          isLoading={loading}
          disabled={actionDisabled}
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      )}

      {warning && (
        <div className={cn("text-center text-red-300", HUD_CUE)} role="alert">
          {warning}
        </div>
      )}

      {tweet && <TwitterShareButton text={tweet} callToActionText="Share your Battle" variant="outline" />}
    </div>
  );
};
