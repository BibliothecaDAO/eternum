import type { ReactNode } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { shortAddress } from "@/ui/design-system/kit/address";
import { formatAmount, formatExact } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { ReasonPlate } from "@/ui/design-system/kit/reason-plate";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { formatDuration } from "@/ui/design-system/kit/time";
import {
  CLAIM,
  CLAIM_ALL,
  CLAIMED_TODAY,
  FULL,
  LABOR,
  LINK_WALLET,
  NO_WALLET,
  REALM,
  REALMS,
  REALMS_ELSEWHERE,
  fitOf,
  realmsADay,
} from "@/ui/design-system/kit/words";

import type { PayoutWallet } from "./payout-wallet";
import type { RealmLaborPlan, RealmLaborState } from "./realm-labor";

/**
 * Realms (value screens, b): the Realms in the linked wallet, which gave their labor today and which are ready, and one
 * Claim all. A full labor store shows what fits and leads with the Realm board, where labor is spent; once all are
 * claimed the wait runs to the day's end.
 */
export const RealmsSheet = ({
  wallet,
  plan,
  perRealm,
  cap,
  labor,
  secondsLeft,
  sending,
  onClaim,
  onRealm,
  onLinkWallet,
  onClose,
}: {
  wallet: PayoutWallet;
  plan: RealmLaborPlan;
  perRealm: number;
  cap: number;
  labor: number | undefined;
  /** Until the game day ends, when every Realm is ready again. */
  secondsLeft: number | undefined;
  sending: boolean;
  onClaim: () => void;
  onRealm: () => void;
  onLinkWallet: () => void;
  onClose: () => void;
}) => (
  <Sheet label={REALMS} onClose={onClose}>
    <header className="flex items-center gap-2.5">
      <KitIcon code="Cs" size={28} />
      <h2 className="frontier-title flex-1 !text-[20px]">{REALMS}</h2>
      {wallet.status !== "no_wallet" && <Chip icons={["Wt"]} label={REALMS} value={shortAddress(wallet.address)} />}
    </header>
    {wallet.status === "no_wallet" ? (
      <>
        <ReasonPlate reason={{ kind: "failed", line: NO_WALLET }} />
        <Button role="primary" icon="Xs" word={LINK_WALLET} onClick={onLinkWallet} />
      </>
    ) : plan.rows.length === 0 ? (
      <NoRealm />
    ) : (
      <>
        {plan.rows.map(({ realm, state }) => (
          <RealmRow key={realm.realmId} name={realm.name} id={realm.realmId} order={realm.order} state={state}>
            {state === "ready" && <LaborChip amount={perRealm} />}
          </RealmRow>
        ))}
        {plan.rows.some((row) => row.state === "locked") && (
          <ReasonPlate reason={{ kind: "failed", line: realmsADay(cap) }} />
        )}
        <ClaimStep
          plan={plan}
          labor={labor}
          secondsLeft={secondsLeft}
          sending={sending}
          onClaim={onClaim}
          onRealm={onRealm}
        />
      </>
    )}
  </Sheet>
);

const ClaimStep = ({
  plan,
  labor,
  secondsLeft,
  sending,
  onClaim,
  onRealm,
}: {
  plan: RealmLaborPlan;
  labor: number | undefined;
  secondsLeft: number | undefined;
  sending: boolean;
  onClaim: () => void;
  onRealm: () => void;
}) => {
  if (plan.total === 0)
    return (
      <ReasonPlate
        reason={{ kind: "failed", line: CLAIMED_TODAY }}
        step={<Chip icons={["Hg"]} label={CLAIMED_TODAY} value={formatDuration(secondsLeft)} />}
      />
    );
  if (plan.fits < plan.total)
    return (
      <>
        <ReasonPlate
          reason={{ kind: "failed", line: fitOf(formatExact(plan.fits), formatExact(plan.total)) }}
          step={<Chip icons={["La"]} label={LABOR} value={FULL} ember />}
        />
        <div className="flex gap-2">
          {plan.fits > 0 && (
            <Button
              role="secondary"
              word={`${CLAIM} ${formatExact(plan.fits)}`}
              loading={sending ? CLAIM : undefined}
              onClick={onClaim}
            />
          )}
          <Button role="primary" icon="Cs" word={REALM} onClick={onRealm} className="flex-1" />
        </div>
      </>
    );
  return (
    <>
      <div className="flex justify-center">
        <Chip
          icons={["La"]}
          label={LABOR}
          value={`${formatExact(labor)} → ${formatExact(labor === undefined ? undefined : labor + plan.total)}`}
        />
      </div>
      <Button role="primary" word={CLAIM_ALL} loading={sending ? CLAIM : undefined} onClick={onClaim} />
    </>
  );
};

const RealmRow = ({
  name,
  id,
  order,
  state,
  children,
}: {
  name: string;
  id: number;
  order: number;
  state: RealmLaborState;
  children?: ReactNode;
}) => (
  <div
    className={cn(
      "frontier-card flex min-h-14 items-center gap-2.5 !rounded-xl px-3 py-2",
      state !== "ready" && "opacity-55",
    )}
  >
    <OrderEmblem order={order} size={28} />
    <span className="min-w-0 flex-1 truncate text-[16px] text-kit-cream">
      {name} <span className="text-[13px] tabular-nums text-kit-muted">#{formatExact(id)}</span>
    </span>
    {state === "claimed" && <KitIcon code="Ok" size={24} />}
    {state === "locked" && <KitIcon code="Lk" size={22} />}
    {children}
  </div>
);

const LaborChip = ({ amount }: { amount: number }) => (
  <span data-tone="lit" className="frontier-chip h-8 shrink-0 !py-0">
    <span className="contents">
      <KitIcon code="La" size={22} />
      <span className="frontier-chip-number tabular-nums !text-[15px]">+{formatAmount(amount)}</span>
    </span>
  </span>
);

const NoRealm = () => (
  <>
    <div className="frontier-card flex h-16 items-center justify-center !rounded-xl border-dashed opacity-80">
      <KitIcon code="Cs" size={40} className="opacity-50" />
    </div>
    <p className="text-center text-[15px] text-kit-cream">{REALMS_ELSEWHERE}</p>
  </>
);
