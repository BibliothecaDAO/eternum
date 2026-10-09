import { lazy, type ReactNode, Suspense, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { PayoutWallet } from "@/hooks/context/payout-wallet";
import { shortAddress } from "@/ui/design-system/kit/address";
import { formatExact } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";

import { Loading } from "../loading";
import { NoStrkLine } from "../value/no-strk-line";
import { lordsOf, refundCall } from "../value/ledger";
import { ENTRY_WORDS, WALLET_WORDS } from "../words";
import {
  entryCalls,
  entryCost,
  type EntryChoice,
  entryState,
  type EntryTerms,
  type SlotLedger,
  useEntryTerms,
} from "./entry";

const WalletSign = lazy(() =>
  import("@/ui/modules/identity/wallet-actions").then((module) => ({ default: module.WalletSign })),
);

/**
 * The lobby's step for a paid Blitz: its entry read from the ledger for the payout wallet, read again once the
 * wallet has sent its call.
 */
export const PaidEntry = ({ ledger, wallet }: { ledger: SlotLedger; wallet: PayoutWallet }) => {
  const terms = useEntryTerms(ledger, wallet.status === "no_wallet" ? null : wallet.address);
  return <EntryPanel ledger={ledger} terms={terms.data} wallet={wallet} onSent={() => void terms.refetch()} />;
};

/**
 * A paid Blitz's entry (design 5h): the seat, and the sword (doubles a won game's MMR) and the shield (halves a lost
 * one's), each 500 LORDS today or a credit from a chest, paid from the payout wallet. A cancelled game refunds what
 * was paid and the credits spent, by the player's own call.
 */
const EntryPanel = ({
  ledger,
  terms,
  wallet,
  onSent,
}: {
  ledger: SlotLedger;
  terms: EntryTerms | undefined;
  wallet: PayoutWallet;
  onSent: () => void;
}) => {
  const [choice, setChoice] = useState<EntryChoice>({ sword: false, shield: false });
  const [signing, setSigning] = useState(false);
  const [sent, setSent] = useState(false);
  if (wallet.status === "no_wallet") return <NoWallet />;
  if (!terms) return <Loading />;
  const state = entryState(terms, choice);
  const cost = entryCost(terms, choice);
  const done = () => {
    setSigning(false);
    setSent(true);
    onSent();
  };

  if (state === "seated") return <Seated terms={terms} />;
  if (state === "refunded") return <Refunded terms={terms} />;
  const sign = signing && (
    <Suspense fallback={<Loading />}>
      <WalletSign
        owner={wallet.address}
        calls={state === "refund" ? [refundCall(ledger.address, ledger.key)] : entryCalls(ledger, terms, choice)}
        onSent={done}
      />
    </Suspense>
  );
  if (state === "refund")
    return (
      <Plate icon="Sk" title={ENTRY_WORDS.cancelled}>
        <Receipt rows={refundRows(terms)} />
        {sign || (
          <Button
            role="primary"
            word={ENTRY_WORDS.takeRefund}
            icon="Lo"
            loading={sent ? ENTRY_WORDS.confirming : undefined}
            onClick={() => setSigning(true)}
          />
        )}
      </Plate>
    );
  return (
    <Plate icon="Lo" title={ENTRY_WORDS.entry} right={<WalletChip address={wallet.address} />}>
      <div className="grid grid-cols-3 gap-2.5">
        <Tile
          icon="Fl"
          word={ENTRY_WORDS.seat}
          effect={ENTRY_WORDS.seatEffect}
          price={terms.prices.seat}
          credit={0}
          on
        />
        <Tile
          icon="At"
          word={ENTRY_WORDS.sword}
          effect={ENTRY_WORDS.swordEffect}
          price={terms.prices.sword}
          credit={terms.credits.swords}
          on={choice.sword}
          onToggle={() => setChoice({ ...choice, sword: !choice.sword })}
        />
        <Tile
          icon="Sd"
          word={ENTRY_WORDS.shield}
          effect={ENTRY_WORDS.shieldEffect}
          price={terms.prices.shield}
          credit={terms.credits.shields}
          on={choice.shield}
          onToggle={() => setChoice({ ...choice, shield: !choice.shield })}
        />
      </div>
      <div className="flex items-end justify-between">
        <span className={cn("flex items-center gap-2", state === "short" ? "text-kit-red" : "text-kit-muted")}>
          <KitIcon code="Wt" size={22} />
          <Lords amount={terms.lords} size={20} />
        </span>
        <span className="flex flex-col items-end">
          <span className="font-ui text-[14px] text-kit-muted">{ENTRY_WORDS.total}</span>
          <Lords amount={cost.cash} size={28} tone={state === "short" ? "text-kit-red" : "text-kit-cream"} />
        </span>
      </div>
      {state === "no-strk" && <NoStrkLine />}
      {sign ||
        (state === "short" ? (
          <Button role="primary" word={ENTRY_WORDS.needMore(formatExact(lordsOf(cost.cash - terms.lords)))} disabled />
        ) : (
          <Button
            role="primary"
            word={ENTRY_WORDS.payAndJoin}
            icon="Pl"
            disabled={state === "no-strk"}
            loading={sent ? ENTRY_WORDS.confirming : undefined}
            onClick={() => setSigning(true)}
          />
        ))}
    </Plate>
  );
};

const NoWallet = () => {
  const navigate = useNavigate();
  return (
    <Plate icon="Lo" title={ENTRY_WORDS.entry}>
      <p className="flex min-h-16 items-center gap-3 rounded-[14px] border border-dashed border-kit-line2 px-3.5 font-body text-[15px] text-kit-muted">
        <KitIcon code="Wt" size={36} />
        {ENTRY_WORDS.paidFromWallet}
      </p>
      <Button role="outline" word={WALLET_WORDS.payoutWallet} icon="Wt" onClick={() => navigate("/profile/account")} />
    </Plate>
  );
};

const Seated = ({ terms }: { terms: EntryTerms }) => {
  const { registration } = terms;
  return (
    <Plate icon="Ok" title={ENTRY_WORDS.seated}>
      <Receipt
        rows={[
          { icon: "Fl", word: ENTRY_WORDS.seat, value: <Lords amount={terms.prices.seat} size={18} /> },
          ...(registration.sword
            ? [
                {
                  icon: "At" as const,
                  word: ENTRY_WORDS.sword,
                  value: flagValue(registration.swordCredit, terms.prices.sword),
                },
              ]
            : []),
          ...(registration.shield
            ? [
                {
                  icon: "Sd" as const,
                  word: ENTRY_WORDS.shield,
                  value: flagValue(registration.shieldCredit, terms.prices.shield),
                },
              ]
            : []),
        ]}
        total={registration.paid}
      />
    </Plate>
  );
};

const Refunded = ({ terms }: { terms: EntryTerms }) => (
  <Plate icon="Ok" title={ENTRY_WORDS.refunded}>
    <p className="font-body text-[16px] text-kit-cream">{ENTRY_WORDS.refundedLine}</p>
    <Lords amount={terms.lords} size={22} />
  </Plate>
);

const refundRows = (terms: EntryTerms) => [
  { icon: "Lo" as const, word: ENTRY_WORDS.lords, value: <Lords amount={terms.registration.paid} size={18} /> },
  ...(terms.registration.swordCredit ? [{ icon: "At" as const, word: ENTRY_WORDS.swordCredit, value: <Back /> }] : []),
  ...(terms.registration.shieldCredit
    ? [{ icon: "Sd" as const, word: ENTRY_WORDS.shieldCredit, value: <Back /> }]
    : []),
];

const flagValue = (fromCredit: boolean, price: bigint) =>
  fromCredit ? <CreditChip /> : <Lords amount={price} size={18} />;

/** Seat, sword or shield: what it does, its price, or the credit that pays for it. */
const Tile = ({
  icon,
  word,
  effect,
  price,
  credit,
  on,
  onToggle,
}: {
  icon: IconCode;
  word: string;
  effect: string;
  price: bigint;
  credit: number;
  on: boolean;
  onToggle?: () => void;
}) => (
  <button
    type="button"
    aria-pressed={on}
    disabled={!onToggle}
    onClick={onToggle}
    className={cn(
      "relative flex flex-col items-center gap-1 rounded-[14px] border-2 px-1 pb-2.5 pt-3",
      on ? "border-kit-gold bg-kit-gold/10" : "border-kit-line opacity-75",
    )}
  >
    {on && (
      <span className="absolute -right-2 -top-2 flex size-[26px] items-center justify-center rounded-full border border-kit-gold bg-kit-ink">
        <KitIcon code="Ok" size={16} />
      </span>
    )}
    <KitIcon code={icon} size={44} />
    <span className="font-ui text-[18px] text-kit-cream">{word}</span>
    <span className="font-body text-[13px] font-bold text-kit-muted">{effect}</span>
    {credit > 0 ? <CreditChip count={credit} /> : <Lords amount={price} size={18} />}
  </button>
);

const Receipt = ({ rows, total }: { rows: { icon: IconCode; word: string; value: ReactNode }[]; total?: bigint }) => (
  <div className="flex flex-col overflow-hidden rounded-xl border border-kit-line">
    {rows.map(({ icon, word, value }) => (
      <div
        key={word}
        className="flex h-12 items-center gap-3 border-b border-kit-line px-3.5 font-ui text-[17px] text-kit-cream last:border-b-0"
      >
        <KitIcon code={icon} size={24} />
        {word}
        <span className="ml-auto">{value}</span>
      </div>
    ))}
    {total !== undefined && (
      <div className="flex h-12 items-center gap-3 bg-kit-gold/10 px-3.5 font-ui text-[17px] text-kit-cream">
        {ENTRY_WORDS.paid}
        <span className="ml-auto">
          <Lords amount={total} size={20} />
        </span>
      </div>
    )}
  </div>
);

const Lords = ({ amount, size, tone = "text-kit-cream" }: { amount: bigint; size: number; tone?: string }) => (
  <span
    className={cn("inline-flex items-center gap-1.5 font-body font-extrabold tabular-nums", tone)}
    style={{ fontSize: size }}
  >
    <KitIcon code="Lo" size={size} />
    {formatExact(lordsOf(amount))}
  </span>
);

const CreditChip = ({ count }: { count?: number }) => (
  <span className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-full border border-kit-gold bg-kit-ink pl-1.5 pr-2.5 font-body text-[13px] font-bold text-kit-gold2">
    <KitIcon code="Ch" size={18} />
    {count && count > 1 ? ENTRY_WORDS.credits(count) : ENTRY_WORDS.credit}
  </span>
);

const Back = () => (
  <span className="inline-flex items-center gap-1 font-body text-[14px] font-bold text-kit-sage">
    <KitIcon code="Ok" size={18} />
    {ENTRY_WORDS.back}
  </span>
);

const WalletChip = ({ address }: { address: string }) => (
  <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-kit-line2 bg-kit-ink pl-1.5 pr-3 font-body text-[14px] font-bold text-kit-muted">
    <KitIcon code="Wt" size={20} />
    {shortAddress(address)}
  </span>
);

const Plate = ({
  icon,
  title,
  right,
  children,
}: {
  icon: IconCode;
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) => (
  <section className="flex flex-col gap-4">
    <h2 className="flex items-center gap-2.5 border-b border-kit-line pb-3 font-ui text-[19px] text-kit-cream">
      <KitIcon code={icon} size={26} />
      {title}
      {right && <span className="ml-auto">{right}</span>}
    </h2>
    {children}
  </section>
);
