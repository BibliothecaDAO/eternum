import { HudButton, HudNotice, HudTabs } from "@/ui/design-system/kit/hud-elements";
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
        <HudTabs
          tabs={[
            { key: "attack", label: "⚔️ Combat" },
            { key: "raid", label: "💰 Raid" },
          ]}
          value={attackType}
          onChange={onSetAttackType}
        />
      )}

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

      {tweet && <TwitterShareButton text={tweet} callToActionText="Share your Battle" />}
    </div>
  );
};
