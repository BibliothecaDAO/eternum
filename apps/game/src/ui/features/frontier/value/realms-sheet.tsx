import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { type FormEvent, type ReactNode, useState } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { shortAddress } from "@/ui/design-system/kit/address";
import { formatAmount, formatExact } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";

import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { ReasonPlate } from "@/ui/design-system/kit/reason-plate";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { formatDuration } from "@/ui/design-system/kit/time";
import {
  ADD_REALM,
  CLAIM,
  CLAIM_ALL,
  CLAIMED_TODAY,
  FULL,
  LABOR,
  LINK_WALLET,
  NO_WALLET,
  REALM,
  REALM_NOT_IN_WALLET,
  REALM_NUMBER,
  REALMS,
  REALMS_ELSEWHERE,
  fitOf,
  realmsADay,
} from "@/ui/design-system/kit/words";

import type { RealmLaborPlan, RealmLaborState } from "./realm-labor";

/** The Realms collection's size: a Realm's number runs from 1 to this. */
const REALM_COUNT = 8000;

/**
 * Realms (value screens, b): the Realms the account has claimed labor with, which gave theirs today and which are
 * ready, one Claim all, and Add a Realm by its number (the relay checks it sits in the linked wallet). A Realm a claim
 * found no longer in the wallet says so and is left out of the claim. A full labor store shows what fits and leads with
 * the Realm board, where labor is spent; once all are claimed the wait runs to the day's end.
 */
export const RealmsSheet = ({
  wallet,
  plan,
  perRealm,
  cap,
  labor,
  secondsLeft,
  sending,
  adding,
  onClaim,
  onAdd,
  onRealm,
  onLinkWallet,
  onClose,
}: {
  /** The linked wallet's address; null when the account has none. */
  wallet: string | null;
  plan: RealmLaborPlan;
  perRealm: number;
  cap: number;
  labor: number | undefined;
  /** Until the game day ends, when every Realm is ready again. */
  secondsLeft: number | undefined;
  sending: boolean;
  /** A Realm being added: its first claim is on its way. */
  adding: boolean;
  onClaim: () => void;
  onAdd: (realmId: number) => void;
  onRealm: () => void;
  onLinkWallet: () => void;
  onClose: () => void;
}) => (
  <Sheet label={REALMS} onClose={onClose}>
    <header className="flex items-center gap-2.5">
      <SemanticIcon name="realm" size={28} />
      <h2 className="frontier-title flex-1 !text-xl">{REALMS}</h2>
      {wallet !== null && <Chip icons={["backpack"]} label={REALMS} value={shortAddress(wallet)} />}
    </header>
    {wallet === null ? (
      <>
        <ReasonPlate reason={{ kind: "failed", line: NO_WALLET }} />
        <Button role="primary" icon="share" word={LINK_WALLET} onClick={onLinkWallet} />
      </>
    ) : (
      <>
        {plan.rows.map(({ realm, state }) => (
          <RealmRow key={realm.realmId} name={realm.name} realmId={realm.realmId} order={realm.order} state={state}>
            {state === "ready" && <LaborChip amount={perRealm} />}
          </RealmRow>
        ))}
        {plan.rows.some((row) => row.state === "locked") && (
          <ReasonPlate reason={{ kind: "failed", line: realmsADay(cap) }} />
        )}
        {plan.canAdd && <AddRealm adding={adding} onAdd={onAdd} />}
        {plan.rows.length === 0 && <p className="text-center text-base text-kit-cream">{REALMS_ELSEWHERE}</p>}
        {plan.rows.length > 0 && (
          <ClaimStep
            plan={plan}
            labor={labor}
            secondsLeft={secondsLeft}
            sending={sending}
            onClaim={onClaim}
            onRealm={onRealm}
          />
        )}
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
    return plan.rows.some((row) => row.state === "claimed") ? (
      <ReasonPlate
        reason={{ kind: "failed", line: CLAIMED_TODAY }}
        step={<Chip icons={["hourglass"]} label={CLAIMED_TODAY} value={formatDuration(secondsLeft)} />}
      />
    ) : null;
  if (plan.fits < plan.total)
    return (
      <>
        <ReasonPlate
          reason={{ kind: "failed", line: fitOf(formatExact(plan.fits), formatExact(plan.total)) }}
          step={<Chip icons={["labor"]} label={LABOR} value={FULL} ember />}
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
          <Button role="primary" icon="realm" word={REALM} onClick={onRealm} className="flex-1" />
        </div>
      </>
    );
  return (
    <>
      <div className="flex justify-center">
        <Chip
          icons={["labor"]}
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
  realmId,
  order,
  state,
  children,
}: {
  name: string;
  realmId: number;
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
    <span className="min-w-0 flex-1 truncate text-base text-kit-cream">
      {name} <span className="text-sm tabular-nums text-kit-muted">#{formatExact(realmId)}</span>
    </span>
    {state === "claimed" && <SemanticIcon name="check" size={24} />}
    {state === "absent" && <span className="shrink-0 text-sm text-kit-muted">{REALM_NOT_IN_WALLET}</span>}
    {state === "locked" && <SemanticIcon name="lock" size={22} />}
    {children}
  </div>
);

const LaborChip = ({ amount }: { amount: number }) => (
  <span data-tone="lit" className="frontier-chip h-8 shrink-0 !py-0">
    <span className="contents">
      <SemanticIcon name="labor" size={22} />
      <span className="frontier-chip-number tabular-nums !text-base">+{formatAmount(amount)}</span>
    </span>
  </span>
);

/**
 * Add a Realm: its number, then Claim. A Realm joins the list once it has given its labor here, so adding one is its
 * first claim; the relay refuses a Realm that is not in the linked wallet.
 */
const AddRealm = ({ adding, onAdd }: { adding: boolean; onAdd: (realmId: number) => void }) => {
  const [number, setNumber] = useState("");
  const realmId = Number(number);
  const valid = Number.isInteger(realmId) && realmId >= 1 && realmId <= REALM_COUNT;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid) onAdd(realmId);
  };
  return (
    <form
      onSubmit={submit}
      aria-label={ADD_REALM}
      className="frontier-card flex min-h-14 items-center gap-2.5 !rounded-xl border-dashed px-3 py-2"
    >
      <SemanticIcon name="realm" size={28} className="opacity-60" />
      <input
        aria-label={REALM_NUMBER}
        inputMode="numeric"
        placeholder={`${ADD_REALM} #`}
        value={number}
        onChange={(event) => setNumber(event.target.value.replace(/\D/g, ""))}
        className="min-w-0 flex-1 bg-transparent text-base tabular-nums text-kit-cream placeholder:text-kit-muted focus:outline-none"
      />
      <Button
        type="submit"
        role="secondary"
        word={CLAIM}
        loading={adding ? CLAIM : undefined}
        disabled={!valid}
        className="!h-10"
      />
    </form>
  );
};
