import { shortAddress } from "@/ui/design-system/kit/address";
import { formatExact } from "@/ui/design-system/kit/amount";
import { AmountSlider } from "@/ui/design-system/kit/amount-slider";
import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { ReasonPlate } from "@/ui/design-system/kit/reason-plate";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { formatDuration } from "@/ui/design-system/kit/time";
import {
  ALL,
  CONTINUE,
  LINK_WALLET,
  LORDS,
  NEW_WALLET,
  NO_WALLET,
  PAYOUTS_PAUSED,
  SENDING,
  TRANSACTION,
  WITHDRAW,
  paidWhenResumed,
} from "@/ui/design-system/kit/words";

import type { PayoutWallet } from "./payout-wallet";

/**
 * Where a withdrawal stands: choosing the amount, sent (the LORDS have left the game's count), paid on Starknet with its
 * transaction, or recorded while payouts were paused and paid when they resume.
 */
export type WithdrawStep =
  | { kind: "pick" }
  | { kind: "sending"; amount: number }
  | { kind: "paid"; amount: number; transactionUrl: string }
  | { kind: "waiting"; amount: number };

/**
 * Withdraw (value screens, a): the realm's LORDS leave the game for the wallet linked to the account, shown and never
 * typed, at once and with no cap. No wallet sends the player to link one in the app; a new wallet waits out its hold;
 * paused payouts refuse before anything leaves.
 */
export const WithdrawSheet = ({
  held,
  wallet,
  paused,
  step,
  amount,
  now,
  onAmount,
  onWithdraw,
  onLinkWallet,
  onClose,
}: {
  held: number | undefined;
  wallet: PayoutWallet;
  paused: boolean;
  step: WithdrawStep;
  amount: number;
  /** Unix milliseconds, for the hold's time left. */
  now: number;
  onAmount: (amount: number) => void;
  onWithdraw: () => void;
  onLinkWallet: () => void;
  onClose: () => void;
}) => (
  <Sheet label={WITHDRAW} onClose={onClose}>
    <h2 className="frontier-title flex items-center gap-2.5 !text-[20px]">
      <KitIcon code={step.kind === "paid" ? "Ok" : "Lo"} size={28} />
      {WITHDRAW}
    </h2>
    <WithdrawBody
      held={held}
      wallet={wallet}
      paused={paused}
      step={step}
      amount={amount}
      now={now}
      onAmount={onAmount}
      onWithdraw={onWithdraw}
      onLinkWallet={onLinkWallet}
      onClose={onClose}
    />
  </Sheet>
);

const WithdrawBody = ({
  held,
  wallet,
  paused,
  step,
  amount,
  now,
  onAmount,
  onWithdraw,
  onLinkWallet,
  onClose,
}: Parameters<typeof WithdrawSheet>[0]) => {
  if (step.kind === "sending") return <Sending amount={step.amount} held={held} wallet={wallet} />;
  if (step.kind === "paid") return <Paid step={step} wallet={wallet} onClose={onClose} />;
  if (step.kind === "waiting") return <Waiting amount={step.amount} held={held} wallet={wallet} />;
  if (wallet.status === "no_wallet") return <NoWallet held={held} onLinkWallet={onLinkWallet} />;
  if (paused) return <Refused held={held} address={wallet.address} line={PAYOUTS_PAUSED} />;
  if (wallet.status === "on_hold")
    return <OnHold held={held} address={wallet.address} secondsLeft={(wallet.until - now) / 1000} />;
  return <Pick held={held} address={wallet.address} amount={amount} onAmount={onAmount} onWithdraw={onWithdraw} />;
};

/** Choose the amount (or all of it), see the count after and where the LORDS go, then Withdraw carrying the amount. */
const Pick = ({
  held,
  address,
  amount,
  onAmount,
  onWithdraw,
}: {
  held: number | undefined;
  address: string;
  amount: number;
  onAmount: (amount: number) => void;
  onWithdraw: () => void;
}) => (
  <>
    <Hero icon="Lo" value={formatExact(amount)} />
    <AmountSlider
      label={LORDS}
      icon="Lo"
      value={amount}
      max={held ?? 0}
      disabled={!held}
      end={
        <button
          type="button"
          data-tone="lit"
          disabled={!held}
          onClick={() => held && onAmount(held)}
          className="frontier-chip h-8 !px-3 font-ui text-[15px] text-kit-cream"
        >
          {ALL}
        </button>
      }
      onChange={onAmount}
    />
    <Flow before={held} after={held === undefined ? undefined : held - amount} address={address} />
    <Button
      role="primary"
      word={WITHDRAW}
      prices={[{ of: "lords", amount }]}
      disabled={!held || amount < 1 || amount > held}
      onClick={onWithdraw}
    />
  </>
);

const NoWallet = ({ held, onLinkWallet }: { held: number | undefined; onLinkWallet: () => void }) => (
  <>
    <Hero icon="Lo" value={formatExact(held)} />
    <ReasonPlate reason={{ kind: "failed", line: NO_WALLET }} />
    <Button role="primary" icon="Xs" word={LINK_WALLET} onClick={onLinkWallet} />
  </>
);

const OnHold = ({ held, address, secondsLeft }: { held: number | undefined; address: string; secondsLeft: number }) => (
  <>
    <Hero icon="Lo" value={formatExact(held)} />
    <div className="flex justify-center">
      <WalletChip address={address} />
    </div>
    <ReasonPlate
      reason={{ kind: "failed", line: NEW_WALLET }}
      step={<Chip icons={["Hg"]} label={NEW_WALLET} value={formatDuration(Math.max(0, secondsLeft))} />}
    />
    <Button role="primary" word={WITHDRAW} disabled />
  </>
);

const Refused = ({ held, address, line }: { held: number | undefined; address: string; line: string }) => (
  <>
    <Hero icon="Lo" value={formatExact(held)} />
    <div className="flex justify-center">
      <WalletChip address={address} />
    </div>
    <ReasonPlate reason={{ kind: "failed", line }} />
    <Button role="primary" word={WITHDRAW} disabled />
  </>
);

const Sending = ({ amount, held, wallet }: { amount: number; held: number | undefined; wallet: PayoutWallet }) => (
  <>
    <Hero icon="Lo" value={formatExact(amount)} />
    <Leaving held={held} wallet={wallet} />
    <Button role="primary" word={WITHDRAW} loading={SENDING} />
  </>
);

const Waiting = ({ amount, held, wallet }: { amount: number; held: number | undefined; wallet: PayoutWallet }) => (
  <>
    <Hero icon="Hg" value={formatExact(amount)} />
    <Leaving held={held} wallet={wallet} />
    <ReasonPlate reason={{ kind: "failed", line: paidWhenResumed(formatExact(amount)) }} />
  </>
);

const Paid = ({
  step,
  wallet,
  onClose,
}: {
  step: Extract<WithdrawStep, { kind: "paid" }>;
  wallet: PayoutWallet;
  onClose: () => void;
}) => (
  <>
    <Hero icon="Wt" value={`+${formatExact(step.amount)}`} />
    {wallet.status !== "no_wallet" && (
      <div className="flex justify-center">
        <WalletChip address={wallet.address} paid />
      </div>
    )}
    <div className="flex gap-2">
      <a
        href={step.transactionUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-kit-line2 px-4 font-ui text-[17px] font-semibold text-kit-cream hover:border-kit-gold"
      >
        <KitIcon code="Xs" size={22} />
        {TRANSACTION}
      </a>
      <Button role="primary" word={CONTINUE} onClick={onClose} className="flex-1" />
    </div>
  </>
);

/** The count left in the game, and the wallet the LORDS are on their way to. */
const Leaving = ({ held, wallet }: { held: number | undefined; wallet: PayoutWallet }) => (
  <div className="flex items-center justify-center gap-1.5">
    <Chip icons={["Lo"]} label={LORDS} value={formatExact(held)} />
    <span aria-hidden className="text-[16px] text-kit-muted">
      →
    </span>
    {wallet.status !== "no_wallet" && <WalletChip address={wallet.address} />}
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
    <Chip icons={["Lo"]} label={LORDS} value={`${formatExact(before)} → ${formatExact(after)}`} />
    <span className="flex items-center gap-1.5">
      <span aria-hidden className="text-[16px] text-kit-muted">
        ↓
      </span>
      <WalletChip address={address} />
    </span>
  </div>
);

const WalletChip = ({ address, paid = false }: { address: string; paid?: boolean }) => (
  <span data-tone={paid ? "gain" : undefined} className="frontier-chip h-7 shrink-0 !py-0">
    <span className="contents">
      <KitIcon code="Wt" size={18} />
      <span className="frontier-chip-number tabular-nums !text-[15px]">{shortAddress(address)}</span>
      {paid && <KitIcon code="Ok" size={18} />}
    </span>
  </span>
);

const Hero = ({ icon, value }: { icon: IconCode; value: string }) => (
  <div className="flex items-center justify-center gap-3.5">
    <span className="flex size-16 items-center justify-center rounded-full border border-kit-line2 bg-kit-ground">
      <KitIcon code={icon} size={44} />
    </span>
    <span className="frontier-hero tabular-nums">{value}</span>
  </div>
);
