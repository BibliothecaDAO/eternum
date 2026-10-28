import { formatShort } from "@bibliothecadao/types";
import { HudButton, HudChip, HudNotice, HudSheet } from "@/ui/design-system/kit/hud-elements";
import {
  REALM,
  REALM_LABOR,
  NO_REALM_LABOR,
  DAILY_REALM_LABOR,
  DAILY_REALM_ESSENCE,
  claimRealmLaborLabel,
  CLAIMING_LABOR,
  partialRealmLabor,
  claimedRealmLabor,
} from "@/ui/design-system/kit/words";
import type { CampaignMark } from "./campaign-home";
import type { RealmLaborPlan } from "./realm-labor";

/** One daily claim for the home founded with a held Realm or a campaign's ticket: its Labor, and a golden one's Essence. */
export const RealmsSheet = ({
  plan,
  dailyAmount,
  dailyEssence,
  mark,
  secondsLeft,
  sending,
  onClaim,
  onRealm,
  onClose,
}: {
  plan: RealmLaborPlan;
  dailyAmount: number;
  dailyEssence: number;
  /** The campaign that founded the home, worn beside its claim. */
  mark: CampaignMark | null;
  secondsLeft: number | undefined;
  sending: boolean;
  onClaim: () => void;
  onRealm: () => void;
  onClose: () => void;
}) => (
  <HudSheet label={REALM_LABOR} onClose={onClose}>
    {!plan.eligible ? (
      <HudNotice line={NO_REALM_LABOR} />
    ) : (
      <>
        {mark && (
          <span>
            <HudChip icons={["realm"]}>{mark.line}</HudChip>
          </span>
        )}
        <span className="flex justify-end gap-2">
          <HudChip icons={["realm", "labor"]} label={DAILY_REALM_LABOR}>
            {formatShort(dailyAmount, { signed: true })}
          </HudChip>
          {dailyEssence > 0 && (
            <HudChip icons={["essence"]} label={DAILY_REALM_ESSENCE}>
              {formatShort(dailyEssence, { signed: true })}
            </HudChip>
          )}
        </span>
        {plan.claimed ? (
          <HudNotice line={claimedRealmLabor(secondsLeft)} />
        ) : (
          <>
            {plan.fits < plan.total && <HudNotice tone="warn" line={partialRealmLabor(plan.fits, plan.total)} />}
            {plan.claimable && (
              <HudButton
                kind={plan.fits < plan.total ? "secondary" : "primary"}
                icon="labor"
                busy={sending ? CLAIMING_LABOR : undefined}
                disabled={sending}
                onClick={onClaim}
              >
                {claimRealmLaborLabel(plan.fits, plan.essence)}
              </HudButton>
            )}
            {plan.fits < plan.total && (
              <HudButton kind="primary" icon="realm" onClick={onRealm}>
                {REALM}
              </HudButton>
            )}
          </>
        )}
      </>
    )}
  </HudSheet>
);
