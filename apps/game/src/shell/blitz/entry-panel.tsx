import { DOORWAY_WORDS, ENTRY_WORDS, mintTestTokenWord, PROFILE_WORDS, WORDS } from "@/ui/design-system/kit/words";
import { formatExact, formatCharge } from "@bibliothecadao/types";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { lazy, type ReactNode, Suspense, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { shortAddress } from "@/ui/design-system/kit/address";
import {
  AppButton,
  AppChip,
  AppChoice,
  AppEmpty,
  AppFigure,
  AppPanel,
  AppRow,
} from "@/ui/design-system/kit/app-elements";

import type { DirectoryGame } from "../herald";
import { Loading } from "../loading";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
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
import { linkWalletHref } from "../profile/settings-route";
import { returnPathOf } from "../return-path";
import { useRequestSignIn } from "../sign-in/connect";
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
  import("@/shell/value/wallet-actions").then((module) => ({ default: module.WalletSign })),
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
        icon="skull"
        title={terms.cancelled ? ENTRY_WORDS.cancelled : ENTRY_WORDS.notSeated}
        aside={<WalletChip address={owner} />}
      >
        <Receipt rows={refundRows(terms)} />
        {sign || (
          <AppButton kind="primary" size="lg" icon="refresh" step onClick={() => setSigning(true)}>
            {ENTRY_WORDS.takeRefund}
          </AppButton>
        )}
      </Plate>
    );
  return (
    <Plate icon="lords" title={ENTRY_WORDS.entry} aside={<WalletChip address={owner} />}>
      <div className="grid grid-cols-3 gap-2.5">
        <Tile
          icon="flag"
          word={ENTRY_WORDS.seat}
          effect={ENTRY_WORDS.seatEffect}
          price={terms.prices.seat}
          credit={0}
          on
        />
        <Tile
          icon="attack"
          word={ENTRY_WORDS.sword}
          effect={ENTRY_WORDS.swordEffect}
          price={terms.prices.sword}
          credit={terms.credits.swords}
          on={choice.sword}
          onToggle={() => setChoice({ ...choice, sword: !choice.sword })}
        />
        <Tile
          icon="defend"
          word={ENTRY_WORDS.shield}
          effect={ENTRY_WORDS.shieldEffect}
          price={terms.prices.shield}
          credit={terms.credits.shields}
          on={choice.shield}
          onToggle={() => setChoice({ ...choice, shield: !choice.shield })}
        />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <AppChip icon="backpack" tone={state === "short" ? "bad" : undefined}>
          {formatExact(lordsOf(terms.lords))}
        </AppChip>
        <AppFigure
          icon="lords"
          value={formatCharge(lordsOf(cost.cash))}
          label={ENTRY_WORDS.total}
          tone={state === "short" ? "bad" : "gold"}
        />
      </div>
      {cost.cash > 0n && <SplitBar shares={entryShares(cost.cash, terms.split)} />}
      {sign ||
        (state === "short" ? (
          <AppButton kind="primary" size="lg" disabled>
            {ENTRY_WORDS.needMore(formatCharge(lordsShortOf(cost.cash - terms.lords)))}
          </AppButton>
        ) : (
          <AppButton kind="primary" size="lg" icon="play" step onClick={() => setSigning(true)}>
            {ENTRY_WORDS.payAndJoin}
          </AppButton>
        ))}
      {!signing && <MintTestToken token={terms.lordsToken} owner={owner} onMinted={onSent} />}
    </Plate>
  );
};

/**
 * Every environment's ledger is paid in a test token with no value: the wallet that pays mints some to itself through
 * that token's own public mint, so an entry can be paid. One signature of its own; the wallet's balance is read again
 * once it lands.
 */
const MintTestToken = ({ token, owner, onMinted }: { token: string; owner: string; onMinted: () => void }) => {
  const [signing, setSigning] = useState(false);
  if (!signing)
    return (
      <AppButton kind="quiet" icon="lords" onClick={() => setSigning(true)}>
        {mintTestTokenWord(formatExact(lordsOf(TEST_TOKEN_MINT)))}
      </AppButton>
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

/** Where this entry's LORDS go when the game settles, as one line: the season pool, the season's chests, the treasury. */
const SplitBar = ({ shares }: { shares: ReturnType<typeof entryShares> }) => {
  const parts = [
    { key: "pool", icon: "victory" as const, amount: shares.pool, tone: "gold" as const },
    { key: "chests", icon: "reward-chest" as const, amount: shares.chests, tone: undefined },
    { key: "treasury", icon: "final-seal" as const, amount: shares.treasury, tone: undefined },
  ].filter((part) => part.amount > 0n);
  return (
    <p className="flex flex-wrap items-center gap-2" aria-label={ENTRY_WORDS.whereItGoes}>
      {parts.map((part) => (
        <AppChip key={part.key} icon={part.icon} tone={part.tone}>
          {formatCharge(lordsOf(part.amount))}
        </AppChip>
      ))}
    </p>
  );
};

/** No payout wallet yet: Account links one, then returns the player to this lobby. */
const NoWallet = () => {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <Plate icon="lords" title={ENTRY_WORDS.entry}>
      <AppEmpty
        icon="backpack"
        line={ENTRY_WORDS.paidFromWallet}
        action={
          <AppButton
            kind="primary"
            size="lg"
            icon="backpack"
            step
            onClick={() => navigate(linkWalletHref(returnPathOf(location)))}
          >
            {PROFILE_WORDS.linkWallet}
          </AppButton>
        }
      />
    </Plate>
  );
};

/** Signed out: the entry is the player's own, so the lobby asks them to sign in and brings them back to it. */
export const SignInToJoin = () => {
  const requestSignIn = useRequestSignIn();
  return (
    <Plate icon="lords" title={ENTRY_WORDS.entry}>
      <AppEmpty
        icon="person"
        line={DOORWAY_WORDS.signInToPlay}
        action={
          <AppButton kind="primary" size="lg" icon="person" step onClick={() => requestSignIn()}>
            {WORDS.signIn}
          </AppButton>
        }
      />
    </Plate>
  );
};

/** Paid, waiting for the close to draw the games, or past the close while they are being drawn. */
const Registered = ({ terms, closed }: { terms: EntryTerms; closed: boolean }) => (
  <Plate icon="check" title={ENTRY_WORDS.registered}>
    <PaidReceipt terms={terms} />
    <p className="text-app-label text-app-muted">{closed ? ENTRY_WORDS.drawingLine : ENTRY_WORDS.registeredLine}</p>
  </Plate>
);

/**
 * Drawn into a game at close: what was paid, and the way to that game's lobby while the directory lists the game (a
 * settled game has left it, and its results are among the player's games on You).
 */
const Seated = ({ terms, game }: { terms: EntryTerms; game: DirectoryGame | undefined }) => {
  const navigate = useNavigate();
  return (
    <Plate icon="check" title={ENTRY_WORDS.seated}>
      <PaidReceipt terms={terms} />
      {game && (
        <AppButton
          kind="primary"
          size="lg"
          icon="play"
          step
          onClick={() => navigate(`/blitz/${lobbyId({ key: gameRowKey(game.chainId, game.game_id) })}`)}
        >
          {ENTRY_WORDS.yourGame}
        </AppButton>
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
        { icon: "flag", word: ENTRY_WORDS.seat, value: <Lords amount={terms.prices.seat} /> },
        ...(registration.sword
          ? [
              {
                icon: "attack" as const,
                word: ENTRY_WORDS.sword,
                value: flagValue(registration.swordCredit, terms.prices.sword),
              },
            ]
          : []),
        ...(registration.shield
          ? [
              {
                icon: "defend" as const,
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
  <Plate icon="hourglass" title={ENTRY_WORDS.entry}>
    <p className="text-app-body text-app-ink">{ENTRY_WORDS.openingLine}</p>
  </Plate>
);

const Closed = () => (
  <Plate icon="lock" title={ENTRY_WORDS.closed}>
    <p className="text-app-body text-app-ink">{ENTRY_WORDS.closedLine}</p>
  </Plate>
);

const Refunded = ({ terms }: { terms: EntryTerms }) => (
  <Plate icon="check" title={ENTRY_WORDS.refunded}>
    <p className="text-app-body text-app-ink">{ENTRY_WORDS.refundedLine}</p>
    <Lords amount={terms.lords} />
  </Plate>
);

const refundRows = (terms: EntryTerms) => [
  { icon: "lords" as const, word: ENTRY_WORDS.lords, value: <Lords amount={terms.registration.paid} /> },
  ...(terms.registration.swordCredit
    ? [{ icon: "attack" as const, word: ENTRY_WORDS.swordCredit, value: <Back /> }]
    : []),
  ...(terms.registration.shieldCredit
    ? [{ icon: "defend" as const, word: ENTRY_WORDS.shieldCredit, value: <Back /> }]
    : []),
];

const flagValue = (fromCredit: boolean, price: bigint) => (fromCredit ? <CreditChip /> : <Lords amount={price} />);

/** Seat, sword or shield: what it does, its price, or the credit that pays for it. The seat is always taken. */
const Tile = ({
  icon,
  word,
  effect,
  price,
  credit,
  on,
  onToggle,
}: {
  icon: IconMeaning;
  word: string;
  effect: string;
  price: bigint;
  credit: number;
  on: boolean;
  onToggle?: () => void;
}) => (
  <AppChoice
    icon={icon}
    title={word}
    detail={effect}
    price={credit > 0 ? <CreditChip count={credit} /> : <Lords amount={price} />}
    selected={on}
    disabled={!onToggle}
    onClick={onToggle}
  />
);

/** What was paid or comes back, a row each, and what was paid in all. */
const Receipt = ({
  rows,
  total,
}: {
  rows: { icon: IconMeaning; word: string; value: ReactNode }[];
  total?: bigint;
}) => (
  <div className="app-well">
    {rows.map(({ icon, word, value }) => (
      <AppRow key={word} lead={<SemanticIcon name={icon} size={24} />} title={word} trail={value} />
    ))}
    {total !== undefined && <AppRow title={ENTRY_WORDS.paid} trail={<Lords amount={total} />} own />}
  </div>
);

/** An amount of LORDS, with its icon. */
const Lords = ({ amount }: { amount: bigint }) => (
  <AppChip icon="lords" tone="gold">
    {formatCharge(lordsOf(amount))}
  </AppChip>
);

const CreditChip = ({ count }: { count?: number }) => (
  <AppChip tone="gold" icon="reward-chest">
    {count && count > 1 ? ENTRY_WORDS.credits(count) : ENTRY_WORDS.credit}
  </AppChip>
);

const Back = () => (
  <AppChip tone="good" icon="check">
    {ENTRY_WORDS.back}
  </AppChip>
);

const WalletChip = ({ address }: { address: string }) => <AppChip icon="backpack">{shortAddress(address)}</AppChip>;

/** The entry's panel: its icon and title, what it shows at its end (the wallet), then its parts, one under another. */
const Plate = ({
  icon,
  title,
  aside,
  children,
}: {
  icon: IconMeaning;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) => (
  <AppPanel icon={icon} title={title} cue={aside}>
    <div className="flex flex-col gap-4">{children}</div>
  </AppPanel>
);
