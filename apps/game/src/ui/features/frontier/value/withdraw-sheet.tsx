import { formatExact, LORDS, formatShort, formatShortChange } from "@bibliothecadao/types";
import type { ReactNode } from "react";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { shortAddress } from "@/ui/design-system/kit/address";
import { AmountInput, HudButton, HudChip, HudNotice, HudSheet } from "@/ui/design-system/kit/hud-elements";
import {
  CONTINUE,
  LINK_WALLET,
  LORDS_GO_TO_WALLET,
  NO_WALLET,
  SENDING,
  TRANSACTION,
  WITHDRAW,
  paidWhenResumed,
  withdrawalUnknown,
} from "@/ui/design-system/kit/words";

import { AmountRange } from "../amount-range";

/**
 * Where a withdrawal stands: choosing the amount (again, with the reason the last one was not applied), sending until
 * the game applies it and the ledger pays it, paid on Starknet with its transaction, recorded while payouts were paused
 * and paid when they resume, or unknown: no answer, so it may still apply.
 */
export type WithdrawStep =
  | { kind: "pick"; notApplied?: string }
  | { kind: "sending"; amount: number }
  | { kind: "paid"; amount: number; transactionUrl: string }
  | { kind: "waiting"; amount: number }
  | { kind: "unknown"; amount: number };

/**
 * Withdraw (value screens, a): the realm's LORDS leave the game for the wallet linked to the account, shown and never
 * typed, at once and with no cap. No wallet sends the player to link one in the app; paused payouts, and the season's
 * closed withdrawals, refuse before anything leaves.
 */
export const WithdrawSheet = ({
  held,
  wallet,
  refusal,
  step,
  amount,
  onAmount,
  onWithdraw,
  onLinkWallet,
  onClose,
}: {
  held: number | undefined;
  /** The linked wallet's address; null when the account has none. */
  wallet: string | null;
  /** Why nothing can leave now, whatever the wallet: said in place of the amount's choice. */
  refusal: string | null;
  step: WithdrawStep;
  amount: number;
  onAmount: (amount: number) => void;
  onWithdraw: () => void;
  onLinkWallet: () => void;
  onClose: () => void;
}) => (
  <HudSheet label={WITHDRAW} onClose={onClose}>
    <WithdrawBody
      held={held}
      wallet={wallet}
      refusal={refusal}
      step={step}
      amount={amount}
      onAmount={onAmount}
      onWithdraw={onWithdraw}
      onLinkWallet={onLinkWallet}
      onClose={onClose}
    />
  </HudSheet>
);

const WithdrawBody = ({
  held,
  wallet,
  refusal,
  step,
  amount,
  onAmount,
  onWithdraw,
  onLinkWallet,
  onClose,
}: Parameters<typeof WithdrawSheet>[0]) => {
  if (step.kind === "sending") return <Sending amount={step.amount} held={held} wallet={wallet} />;
  if (step.kind === "paid") return <Paid step={step} wallet={wallet} onClose={onClose} />;
  if (step.kind === "waiting") return <Waiting amount={step.amount} held={held} wallet={wallet} />;
  if (step.kind === "unknown") return <Unknown amount={step.amount} held={held} wallet={wallet} onClose={onClose} />;
  if (wallet === null) return <NoWallet held={held} onLinkWallet={onLinkWallet} />;
  if (refusal) return <Refused held={held} address={wallet} line={refusal} />;
  return (
    <Pick
      held={held}
      address={wallet}
      amount={amount}
      notApplied={step.notApplied}
      onAmount={onAmount}
      onWithdraw={onWithdraw}
    />
  );
};

/**
 * Choose the amount: typed where it shows, dragged, or all of it; see the count after and where the LORDS go, then
 * Withdraw carrying the amount (Enter in the amount withdraws too). After a withdrawal the game did not apply, its
 * reason stands over the choice.
 */
const Pick = ({
  held,
  address,
  amount,
  notApplied,
  onAmount,
  onWithdraw,
}: {
  held: number | undefined;
  address: string;
  amount: number;
  notApplied: string | undefined;
  onAmount: (amount: number) => void;
  onWithdraw: () => void;
}) => {
  const ready = held !== undefined && amount >= 1 && amount <= held;
  return (
    <form
      className="contents"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) onWithdraw();
      }}
    >
      <Hero icon="lords">
        <AmountInput display label={LORDS} value={amount} max={held ?? 0} disabled={!held} onChange={onAmount} />
      </Hero>
      <AmountRange label={LORDS} icon="lords" value={amount} max={held ?? 0} disabled={!held} onChange={onAmount} />
      <Flow before={held} after={held === undefined ? undefined : held - amount} address={address} />
      {notApplied && <HudNotice tone="warn" line={notApplied} />}
      <HudButton kind="primary" type="submit" disabled={!ready}>
        {WITHDRAW}
      </HudButton>
    </form>
  );
};

const NoWallet = ({ held, onLinkWallet }: { held: number | undefined; onLinkWallet: () => void }) => (
  <>
    <Hero icon="lords">{formatExact(held)}</Hero>
    <p className="text-center">{LORDS_GO_TO_WALLET}</p>
    <HudNotice tone="warn" line={NO_WALLET} />
    <HudButton kind="primary" icon="share" onClick={onLinkWallet}>
      {LINK_WALLET}
    </HudButton>
  </>
);

const Refused = ({ held, address, line }: { held: number | undefined; address: string; line: string }) => (
  <>
    <Hero icon="lords">{formatExact(held)}</Hero>
    <div className="flex justify-center">
      <WalletChip address={address} />
    </div>
    <HudNotice tone="warn" line={line} />
    <HudButton kind="primary" disabled>
      {WITHDRAW}
    </HudButton>
  </>
);

const Sending = ({ amount, held, wallet }: { amount: number; held: number | undefined; wallet: string | null }) => (
  <>
    <Hero icon="lords">{formatExact(amount)}</Hero>
    <Leaving held={held} wallet={wallet} />
    <HudButton kind="primary" busy={SENDING}>
      {WITHDRAW}
    </HudButton>
  </>
);

const Waiting = ({ amount, held, wallet }: { amount: number; held: number | undefined; wallet: string | null }) => (
  <>
    <Hero icon="hourglass">{formatExact(amount)}</Hero>
    <Leaving held={held} wallet={wallet} />
    <HudNotice tone="warn" line={paidWhenResumed(formatExact(amount))} />
  </>
);

/** No answer from the game: the withdrawal may still apply, so the sheet says so and offers no second send. */
const Unknown = ({
  amount,
  held,
  wallet,
  onClose,
}: {
  amount: number;
  held: number | undefined;
  wallet: string | null;
  onClose: () => void;
}) => (
  <>
    <Hero icon="hourglass">{formatExact(amount)}</Hero>
    <Leaving held={held} wallet={wallet} />
    <HudNotice tone="warn" line={withdrawalUnknown(formatExact(amount))} />
    <HudButton kind="primary" onClick={onClose}>
      {CONTINUE}
    </HudButton>
  </>
);

const Paid = ({
  step,
  wallet,
  onClose,
}: {
  step: Extract<WithdrawStep, { kind: "paid" }>;
  wallet: string | null;
  onClose: () => void;
}) => (
  <>
    <Hero icon="backpack">{`+${formatExact(step.amount)}`}</Hero>
    {wallet !== null && (
      <div className="flex justify-center">
        <WalletChip address={wallet} paid />
      </div>
    )}
    <div className="grid auto-cols-fr grid-flow-col gap-2">
      <HudButton
        kind="secondary"
        icon="share"
        onClick={() => window.open(step.transactionUrl, "_blank", "noopener,noreferrer")}
      >
        {TRANSACTION}
      </HudButton>
      <HudButton kind="primary" onClick={onClose}>
        {CONTINUE}
      </HudButton>
    </div>
  </>
);

/** The count left in the game, and the wallet the LORDS are on their way to. */
const Leaving = ({ held, wallet }: { held: number | undefined; wallet: string | null }) => (
  <div className="flex items-center justify-center gap-1.5">
    <HudChip icons={["lords"]} label={LORDS}>
      {formatShort(held)}
    </HudChip>
    <span aria-hidden className="text-hud-muted">
      →
    </span>
    {wallet !== null && <WalletChip address={wallet} />}
  </div>
);

const Flow = ({
  before,
  after,
  address,
}: {
  before: number | undefined;
  after: number | undefined;
  address: string;
}) => (
  <div className="flex flex-col items-center gap-1.5">
    <HudChip icons={["lords"]} label={LORDS}>
      {formatShortChange(before, after)}
    </HudChip>
    <span className="flex items-center gap-1.5">
      <span aria-hidden className="text-hud-muted">
        ↓
      </span>
      <WalletChip address={address} />
    </span>
  </div>
);

const WalletChip = ({ address, paid = false }: { address: string; paid?: boolean }) => (
  <HudChip icons={["backpack"]} tone={paid ? "good" : undefined}>
    {shortAddress(address)}
    {paid && <SemanticIcon name="check" size={16} />}
  </HudChip>
);

/** The amount the sheet is about, large, beside what it is. */
const Hero = ({ icon, children }: { icon: IconMeaning; children: ReactNode }) => (
  <div className="flex items-center justify-center gap-3.5">
    <span className="flex size-16 items-center justify-center rounded-full border border-hud-line">
      <SemanticIcon name={icon} size={44} />
    </span>
    <span className="text-hud-display tabular-nums">{children}</span>
  </div>
);
