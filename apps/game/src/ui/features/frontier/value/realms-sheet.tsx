import { HudButton, HudNotice, HudSheet } from "@/ui/design-system/kit/hud-elements";
import {
  REALM,
  REALM_LABOR,
  NO_REALM_LABOR,
  settledRealmLabor,
  claimRealmLaborLabel,
  CLAIMING_LABOR,
  partialRealmLabor,
  claimedRealmLabor,
} from "@/ui/design-system/kit/words";
import type { RealmLaborPlan } from "./realm-labor";

/** One daily claim for the home founded with a held Realm. */
export const RealmsSheet = ({
  plan,
  dailyAmount,
  secondsLeft,
  sending,
  onClaim,
  onRealm,
  onClose,
}: {
  plan: RealmLaborPlan;
  dailyAmount: number;
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
        <p>{settledRealmLabor(dailyAmount)}</p>
        {plan.claimed ? (
          <HudNotice line={claimedRealmLabor(secondsLeft)} />
        ) : (
          <>
            {plan.fits < plan.total && <HudNotice tone="warn" line={partialRealmLabor(plan.fits, plan.total)} />}
            {plan.fits > 0 && (
              <HudButton
                kind={plan.fits < plan.total ? "secondary" : "primary"}
                icon="labor"
                busy={sending ? CLAIMING_LABOR : undefined}
                disabled={sending}
                onClick={onClaim}
              >
                {claimRealmLaborLabel(plan.fits)}
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
