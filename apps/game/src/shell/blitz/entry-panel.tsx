import { lazy, type ReactNode, Suspense, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { shortAddress } from "@/ui/design-system/kit/address";
import { formatExact } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";

import type { DirectoryGame } from "../herald";
import { Loading } from "../loading";
import { ServiceFailure } from "../service-failure";
import { useNowSeconds } from "../use-now";
import {
  type EnvironmentLedger,
  lordsOf,
  lordsShortOf,
  mintTestTokenCall,
  refundCall,
  type SlotKey,
  TEST_TOKEN_MINT,
} from "../value/ledger";
import { gameRowKey } from "../blitz-rows";
import { linkWalletHref } from "../profile/account-route";
import { returnPathOf, useRequestSignIn } from "../sign-in/sign-in-route";
import { DOORWAY_WORDS, ENTRY_WORDS, mintTestTokenWord, PROFILE_WORDS, WORDS } from "../words";
import {
  entryCalls,
  entryCost,
  type EntryChoice,
  entryShares,
  entryState,
  type EntryTerms,
  useEntryTerms,
  useRefundsChanged,
} from "./entry";
import { lobbyId } from "./lobby";

const WalletSign = lazy(() =>
  import("@/ui/modules/identity/wallet-actions").then((module) => ({ default: module.WalletSign })),
);

/**
 * The lobby's step for a paid Blitz slot: its entry read from the ledger for `owner`, the wallet that pays and
 * registers (the payout wallet, or the wallet a closed slot owes a refund), and read again once the wallet has sent its
 * call. A registration made from a wallet replaced before the slot closes shows on the game's roster once it closes,
 * not here.
 */
export const PaidEntry = ({
  ledger,
  slot,
  owner,
  game,
}: {
  ledger: EnvironmentLedger;
  slot: SlotKey;
  /** Null while the player has linked no payout wallet. */
  owner: string | null;
  /** The launched game of this slot whose roster seats the wallet, while the directory lists it. */
  game: DirectoryGame | undefined;
}) => {
  const terms = useEntryTerms(ledger, slot, owner);
  const refundsChanged = useRefundsChanged();
  if (owner === null) return <NoWallet />;
  if (terms.isError) return <ServiceFailure service="ledger" error={terms.error} retry={() => void terms.refetch()} />;
  if (terms.data === null) return <Opening />;
  return (
    <EntryPanel
      ledger={ledger.address}
      slot={slot}
      terms={terms.data}
      owner={owner}
      game={game}
      onSent={() => {
        void terms.refetch();
        refundsChanged();
      }}
    />
  );
};

/**
 * A paid Blitz's entry (design 5h): the seat, and the sword (doubles a won game's MMR) and the shield (halves a lost
 * one's), each 500 LORDS today or a credit from a chest, paid from the payout wallet. Registered until the slot's
 * close, then seated in a game; a cancelled slot, or a registration the close left unseated, refunds what was paid
 * and the credits spent, by the player's own call.
 */
const EntryPanel = ({
  ledger,
  slot,
  terms,
  owner,
  game,
  onSent,
}: {
  /** The environment's ledger address, which the calls go to. */
  ledger: string;
  slot: SlotKey;
  terms: EntryTerms | undefined;
  /** The wallet that pays and registers, and takes any refund of what it paid. */
  owner: string;
  game: DirectoryGame | undefined;
  onSent: () => void;
}) => {
  const [choice, setChoice] = useState<EntryChoice>({ sword: false, shield: false });
  const [signing, setSigning] = useState(false);
  const now = useNowSeconds();
  if (!terms) return <Loading />;
  const state = entryState(terms, choice, now, game !== undefined);
  const cost = entryCost(terms, choice);

  if (state === "registered") return <Registered terms={terms} closed={now >= terms.close} />;
  if (state === "seated") return <Seated terms={terms} game={game} />;
  if (state === "refunded") return <Refunded terms={terms} />;
  if (state === "closed") return <Closed />;
  const sign = signing && (
    <Suspense fallback={<Loading />}>
      <WalletSign
        owner={owner}
        calls={state === "refund" ? [refundCall(ledger, slot)] : entryCalls(ledger, slot, terms, choice)}
        onLanded={() => {
          setSigning(false);
          onSent();
        }}
      />
    </Suspense>
  );
  if (state === "refund")
    return (
      <Plate
        icon="Sk"
        title={terms.cancelled ? ENTRY_WORDS.cancelled : ENTRY_WORDS.notSeated}
        right={<WalletChip address={owner} />}
      >
        <Receipt rows={refundRows(terms)} />
        {sign || <Button role="primary" word={ENTRY_WORDS.takeRefund} icon="Sp" onClick={() => setSigning(true)} />}
      </Plate>
    );
  return (
    <Plate icon="Lo" title={ENTRY_WORDS.entry} right={<WalletChip address={owner} />}>
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
      {cost.cash > 0n && <SplitBar shares={entryShares(cost.cash, terms.split)} />}
      {sign ||
        (state === "short" ? (
          <Button
            role="primary"
            word={ENTRY_WORDS.needMore(formatExact(lordsShortOf(cost.cash - terms.lords)))}
            disabled
          />
        ) : (
          <Button role="primary" word={ENTRY_WORDS.payAndJoin} icon="Pl" onClick={() => setSigning(true)} />
        ))}
      {/* Asked of the build constant here, at this line: a production bundle holds neither the button nor its call. */}
      {import.meta.env.VITE_PUBLIC_ENVIRONMENT !== "production" && !signing && (
        <MintTestToken token={terms.lordsToken} owner={owner} onMinted={onSent} />
      )}
    </Plate>
  );
};

/**
 * A dev build only: its ledger is paid in a test token with no value, never LORDS, and the wallet that pays mints some
 * to itself through that token's own public mint, so an entry can be tried. One signature of its own; the wallet's
 * balance is read again once it lands.
 */
const MintTestToken = ({ token, owner, onMinted }: { token: string; owner: string; onMinted: () => void }) => {
  const [signing, setSigning] = useState(false);
  if (!signing)
    return (
      <Button
        role="outline"
        word={mintTestTokenWord(formatExact(lordsOf(TEST_TOKEN_MINT)))}
        icon="Lo"
        onClick={() => setSigning(true)}
      />
    );
  return (
    <Suspense fallback={<Loading />}>
      <WalletSign
        owner={owner}
        calls={[mintTestTokenCall(token, owner)]}
        onLanded={() => {
          setSigning(false);
          onMinted();
        }}
      />
    </Suspense>
  );
};

/** Where this entry's LORDS go when the game settles: the season pool, the season's chests, the treasury. */
const SplitBar = ({ shares }: { shares: ReturnType<typeof entryShares> }) => {
  const parts = [
    { key: "pool", icon: "Tp" as const, amount: shares.pool, bar: "bg-kit-gold", tone: "text-kit-gold2" },
    { key: "chests", icon: "Ch" as const, amount: shares.chests, bar: "bg-kit-line2", tone: "text-kit-cream" },
    { key: "treasury", icon: "Fx" as const, amount: shares.treasury, bar: "bg-kit-line", tone: "text-kit-muted" },
  ].filter((part) => part.amount > 0n);
  return (
    <div className="flex flex-col gap-2" aria-label={ENTRY_WORDS.whereItGoes}>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
        {parts.map((part) => (
          <span key={part.key} className={part.bar} style={{ flex: Number(part.amount / 10n ** 15n) }} />
        ))}
      </div>
      <div className="flex justify-between gap-2">
        {parts.map((part) => (
          <span
            key={part.key}
            className={cn("inline-flex items-center gap-1 font-body text-[14px] font-bold", part.tone)}
          >
            <KitIcon code={part.icon} size={18} />
            {formatExact(lordsOf(part.amount))}
          </span>
        ))}
      </div>
    </div>
  );
};

/** No payout wallet yet: Account links one, then returns the player to this lobby. */
const NoWallet = () => {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <Plate icon="Lo" title={ENTRY_WORDS.entry}>
      <EntryLine icon="Wt" line={ENTRY_WORDS.paidFromWallet} />
      <Button
        role="primary"
        word={PROFILE_WORDS.linkWallet}
        icon="Wt"
        onClick={() => navigate(linkWalletHref(returnPathOf(location)))}
      />
    </Plate>
  );
};

/** Signed out: the entry is the player's own, so the lobby asks them to sign in and brings them back to it. */
export const SignInToJoin = () => {
  const requestSignIn = useRequestSignIn();
  return (
    <Plate icon="Lo" title={ENTRY_WORDS.entry}>
      <EntryLine icon="Pf" line={DOORWAY_WORDS.signInToPlay} />
      <Button role="primary" word={WORDS.signIn} icon="Pf" onClick={() => requestSignIn()} />
    </Plate>
  );
};

const EntryLine = ({ icon, line }: { icon: IconCode; line: string }) => (
  <p className="flex min-h-16 items-center gap-3 rounded-[14px] border border-dashed border-kit-line2 px-3.5 font-body text-[15px] text-kit-muted">
    <KitIcon code={icon} size={36} />
    {line}
  </p>
);

/** Paid, waiting for the close to draw the games, or past the close while they are being drawn. */
const Registered = ({ terms, closed }: { terms: EntryTerms; closed: boolean }) => (
  <Plate icon="Ok" title={ENTRY_WORDS.registered}>
    <PaidReceipt terms={terms} />
    <p className="font-body text-[15px] text-kit-muted">
      {closed ? ENTRY_WORDS.drawingLine : ENTRY_WORDS.registeredLine}
    </p>
  </Plate>
);

/**
 * Drawn into a game at close: what was paid, and the way to that game's lobby while the directory lists the game (a
 * settled game has left it, and its results are on the Season tab).
 */
const Seated = ({ terms, game }: { terms: EntryTerms; game: DirectoryGame | undefined }) => {
  const navigate = useNavigate();
  return (
    <Plate icon="Ok" title={ENTRY_WORDS.seated}>
      <PaidReceipt terms={terms} />
      {game && (
        <Button
          role="primary"
          word={ENTRY_WORDS.yourGame}
          icon="Pl"
          onClick={() => navigate(`/blitz/${lobbyId({ key: gameRowKey(game.chainId, game.game_id) })}`)}
        />
      )}
    </Plate>
  );
};

/** The seat and any flags, each with its price or the credit that paid it, and the LORDS paid in all. */
const PaidReceipt = ({ terms }: { terms: EntryTerms }) => {
  const { registration } = terms;
  return (
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
  );
};

/** Listed, and not on the ledger yet: nothing failed and nothing is asked of the player; the panel reads again itself. */
const Opening = () => (
  <Plate icon="Hg" title={ENTRY_WORDS.entry}>
    <p className="font-body text-[16px] text-kit-cream">{ENTRY_WORDS.openingLine}</p>
  </Plate>
);

const Closed = () => (
  <Plate icon="Lk" title={ENTRY_WORDS.closed}>
    <p className="font-body text-[16px] text-kit-cream">{ENTRY_WORDS.closedLine}</p>
  </Plate>
);

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
