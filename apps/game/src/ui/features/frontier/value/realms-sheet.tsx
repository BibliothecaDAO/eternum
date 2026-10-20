import { formatAmount, formatExact } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { iconDefinition, orderMeaning } from "@/ui/design-system/icon-meaning";
import { type FormEvent, type ReactNode, useState } from "react";

import { shortAddress } from "@/ui/design-system/kit/address";
import { HudButton, HudChip, HudField, HudNotice, HudRow, HudSheet } from "@/ui/design-system/kit/hud-elements";
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
  dayLeft,
  fitOf,
  realmsADay,
  realmsGiveLabor,
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
  <HudSheet label={REALMS} onClose={onClose}>
    <p className="text-center">{realmsGiveLabor(perRealm, cap)}</p>
    {wallet !== null && (
      <span className="flex justify-end">
        <HudChip icons={["backpack"]} label={REALMS}>
          {shortAddress(wallet)}
        </HudChip>
      </span>
    )}
    {wallet === null ? (
      <>
        <HudNotice tone="warn" line={NO_WALLET} />
        <HudButton kind="primary" icon="share" onClick={onLinkWallet}>
          {LINK_WALLET}
        </HudButton>
      </>
    ) : (
      <>
        {plan.rows.map(({ realm, state }) => (
          <RealmRow key={realm.realmId} name={realm.name} realmId={realm.realmId} order={realm.order} state={state}>
            {state === "ready" && <LaborChip amount={perRealm} />}
          </RealmRow>
        ))}
        {plan.rows.some((row) => row.state === "locked") && <HudNotice tone="warn" line={realmsADay(cap)} />}
        {plan.canAdd && <AddRealm adding={adding} onAdd={onAdd} />}
        {plan.rows.length === 0 && <p className="text-center">{REALMS_ELSEWHERE}</p>}
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
  </HudSheet>
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
      <span className="flex items-center gap-2">
        <span className="flex-1">
          <HudNotice line={CLAIMED_TODAY} />
        </span>
        <HudChip icons={["hourglass"]} label={CLAIMED_TODAY}>
          {dayLeft(secondsLeft).reading}
        </HudChip>
      </span>
    ) : null;
  if (plan.fits < plan.total)
    return (
      <>
        <span className="flex items-center gap-2">
          <span className="flex-1">
            <HudNotice tone="warn" line={fitOf(formatExact(plan.fits), formatExact(plan.total))} />
          </span>
          <HudChip icons={["labor"]} label={LABOR} tone="bad">
            {FULL}
          </HudChip>
        </span>
        <div className="grid auto-cols-fr grid-flow-col gap-2">
          {plan.fits > 0 && (
            <HudButton kind="secondary" busy={sending ? CLAIM : undefined} onClick={onClaim}>
              {`${CLAIM} ${formatExact(plan.fits)}`}
            </HudButton>
          )}
          <HudButton kind="primary" icon="realm" onClick={onRealm}>
            {REALM}
          </HudButton>
        </div>
      </>
    );
  return (
    <>
      <div className="flex justify-center">
        <HudChip icons={["labor"]} label={LABOR}>
          {`${formatExact(labor)} → ${formatExact(labor === undefined ? undefined : labor + plan.total)}`}
        </HudChip>
      </div>
      <HudButton kind="primary" busy={sending ? CLAIM : undefined} onClick={onClaim}>
        {CLAIM_ALL}
      </HudButton>
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
  <HudRow
    lead={<SemanticIcon name={orderMeaning(order)} size={28} alt={iconDefinition(orderMeaning(order)).label} />}
    title={
      <>
        {name} <span className="text-hud-label tabular-nums text-hud-muted">#{formatExact(realmId)}</span>
      </>
    }
    disabled={state !== "ready"}
    trail={
      <span className="flex items-center gap-1">
        {state === "claimed" && <SemanticIcon name="check" size={24} />}
        {state === "absent" && <span className="text-hud-label text-hud-muted">{REALM_NOT_IN_WALLET}</span>}
        {state === "locked" && <SemanticIcon name="lock" size={22} />}
        {children}
      </span>
    }
  />
);

const LaborChip = ({ amount }: { amount: number }) => (
  <HudChip icons={["labor"]} tone="good">{`+${formatAmount(amount)}`}</HudChip>
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
    <form onSubmit={submit} aria-label={ADD_REALM} className="flex items-center gap-2">
      <SemanticIcon name="realm" size={28} />
      <HudField
        aria-label={REALM_NUMBER}
        inputMode="numeric"
        placeholder={`${ADD_REALM} #`}
        value={number}
        onChange={(text) => setNumber(text.replace(/\D/g, ""))}
      />
      <HudButton type="submit" kind="secondary" busy={adding ? CLAIM : undefined} disabled={!valid}>
        {CLAIM}
      </HudButton>
    </form>
  );
};
