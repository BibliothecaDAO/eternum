import { HudButton, HudNotice } from "@/ui/design-system/kit/hud-elements";
import TwitterShareButton from "@/ui/design-system/molecules/twitter-share-button";

import { BattleCooldownTimer } from "../battle-cooldown-timer";

interface ActionFooterProps {
  mode: "live" | "sim";
  isEdited: boolean;
  onResetToLive: () => void;
  actionLabel: string;
  actionDisabled: boolean;
  loading: boolean;
  onAction: () => void;
  warning?: string | null;
  /** Writes the battle's shared line when Share is pressed; none, no Share. */
  share?: () => string;
  cooldownEnd?: number;
}

export const ActionFooter = ({
  mode,
  isEdited,
  onResetToLive,
  actionLabel,
  actionDisabled,
  loading,
  onAction,
  warning,
  share,
  cooldownEnd,
}: ActionFooterProps) => {
  return (
    <div className="flex flex-col items-center gap-3">
      {mode === "live" && isEdited && (
        <HudButton kind="quiet" size="sm" icon="refresh" onClick={onResetToLive}>
          Reset to live
        </HudButton>
      )}

      {mode === "live" && cooldownEnd !== undefined && cooldownEnd > Math.floor(Date.now() / 1000) && (
        <BattleCooldownTimer cooldownEnd={cooldownEnd} />
      )}

      {mode === "live" && (
        <HudButton kind="primary" busy={loading ? actionLabel : undefined} disabled={actionDisabled} onClick={onAction}>
          {actionLabel}
        </HudButton>
      )}

      {warning && <HudNotice tone="bad" line={warning} />}

      {share && <TwitterShareButton text={share} callToActionText="Share your Battle" />}
    </div>
  );
};
