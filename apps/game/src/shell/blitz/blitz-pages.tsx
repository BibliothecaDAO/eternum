import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import type { PayoutWallet } from "@realms-world/identity";

import { payoutWalletOf } from "@/hooks/context/payout-wallet";
import { useIdentitySession } from "@/hooks/context/identity-session";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Button } from "@/ui/design-system/kit/button";

import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";

import { type BlitzRow, seatedGameOf, slotKeyOf } from "../blitz-rows";
import { ClockChip } from "../clock-chip";
import { useLayout } from "../frame/layout";
import { type DirectoryGame, useRealmsPlayer } from "../herald";
import { PageFrame } from "../frame/page-frame";
import { StepVerb } from "../frame/step-verb";
import { entryHref } from "../game-links";
import { Loading } from "../loading";
import { NothingHere } from "../not-found";
import { paintingSources } from "../paintings";
import { AgeLabel } from "../play/age-card";
import { ageOf } from "../play/ages";
import { type PlayFacts, usePlayFacts } from "../play/play-facts";
import { LiveChip, StateChip } from "../play/state-chip";
import { ServiceFailure } from "../service-failure";
import { FailureLine } from "../sign-in/failure-line";
import { type EnvironmentLedger, environmentLedger } from "../value/ledger";
import { BLITZ_WORDS, ENTRY_WORDS, WALLET_WORDS, WORDS } from "../words";
import { chatMembershipOf, useEntryTerms } from "./entry";
import { PaidEntry } from "./entry-panel";
import { GameRow, SeatsChip } from "./game-row";
import { type LobbyStep, lobbyId, lobbyRowOf, lobbyStep, lobbyTitle, seatsOf } from "./lobby";
import { LobbyChatPanel } from "./lobby-chat-panel";
import { RegisteredCount, RosterGrid, SeatGrid } from "./seat-grid";

const BLITZ = ageOf("blitz");

/**
 * Blitz's games (spec 05): live first, then by start, each with when, its seats and one action; a row opens its
 * lobby. The age's painting heads the list on a phone; the desktop stands the list on it, the next filling game's
 * lobby beside it.
 */
export const BlitzListPage = () => {
  const facts = usePlayFacts();
  const desktop = useLayout() === "desktop";
  const rows = (
    <section className="plate px-3">
      <BlitzRows facts={facts} />
    </section>
  );
  return (
    <PageFrame back="/" title={BLITZ.name} painting={BLITZ.painting} stage>
      {desktop ? (
        <div className="grid grid-cols-[minmax(0,1fr)_34rem] items-start gap-6">
          {rows}
          <NextLobby facts={facts} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <AgeHeader />
          {rows}
        </div>
      )}
    </PageFrame>
  );
};

/** Beside the desktop's rows: the next slot taking players, as its lobby shows it, with its one step. */
const NextLobby = ({ facts }: { facts: PlayFacts }) => {
  const row = facts.blitz.find((candidate) => candidate.kind === "slot" && candidate.action === "open");
  if (row?.kind !== "slot") return null;
  const step = lobbyStep(row);
  return (
    <section className="plate flex flex-col gap-4 p-5">
      <Link to={`/blitz/${lobbyId(row)}`} className="painted flex h-36 items-end rounded-xl p-4">
        <img
          {...paintingSources(BLITZ.painting)}
          sizes="34rem"
          alt=""
          className="absolute inset-0 -z-10 size-full object-cover"
        />
        <span className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-kit-ground/90" />
        <span className="flex items-baseline gap-2">
          <AgeLabel numeral={BLITZ.numeral} />
          <h2 className="font-display text-[34px] leading-none text-kit-cream">{lobbyTitle(row)}</h2>
        </span>
      </Link>
      <LobbyClock row={row} step={step} now={facts.now} />
      <RegisteredCount slot={row.slot} large={false} closed={false} />
      <LobbyAction row={row} step={step} desktop />
    </section>
  );
};

const AgeHeader = () => (
  <header className="painted flex h-36 items-end rounded-2xl p-3">
    <img
      {...paintingSources(BLITZ.painting)}
      sizes="100vw"
      alt=""
      className="absolute inset-0 -z-10 size-full object-cover"
    />
    <span className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-kit-ground/20 to-kit-ground/90" />
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-2">
        <AgeLabel numeral={BLITZ.numeral} />
        <h2 className="font-ui text-[20px] font-bold text-kit-cream">{BLITZ.name}</h2>
      </span>
      <p className="text-[13px] text-kit-muted">{BLITZ.lore}</p>
    </div>
  </header>
);

/** The games as rows, live first; a panel shows the first few. */
export const BlitzRows = ({ facts, limit }: { facts: PlayFacts; limit?: number }) => {
  if (facts.slots.isError)
    return <ServiceFailure service="slots" error={facts.slots.error} retry={() => void facts.slots.refetch()} />;
  if (facts.directory.isError)
    return (
      <ServiceFailure service="directory" error={facts.directory.error} retry={() => void facts.directory.refetch()} />
    );
  if (!facts.slots.isSuccess || !facts.directory.isSuccess) return <Loading />;
  return (
    <ul>
      {facts.blitz.slice(0, limit).map((row) => (
        <GameRow key={row.key} row={row} now={facts.now} />
      ))}
    </ul>
  );
};

/**
 * One Blitz before it starts (spec 06): its clock and one step. A slot shows its registered count and its paid entry; a
 * launched game its seats with the player's own ringed, Preparing until the roster's realms are ready, then Enter.
 * There is no way out of a seat (ruled).
 */
export const BlitzLobbyPage = () => {
  const { id } = useParams();
  const facts = usePlayFacts();
  const layout = useLayout();
  const { data: player } = useRealmsPlayer();
  const { session } = useIdentitySession();
  const row = lobbyRowOf(facts.blitz, facts.slots.data?.slots ?? [], id);
  if (!row) {
    return (
      <PageFrame back="/blitz" title={BLITZ.name} tabs={false}>
        {facts.slots.isSuccess && facts.directory.isSuccess ? <NothingHere /> : <Loading />}
      </PageFrame>
    );
  }
  const step = lobbyStep(row);
  const clock = <LobbyClock row={row} step={step} now={facts.now} />;
  const desktop = layout === "desktop";
  const wallet = session ? payoutWalletOf(session.user) : null;
  const action =
    row.kind === "game" ? (
      <LobbyAction row={row} step={step} desktop={desktop} />
    ) : (
      <SlotEntry slot={row.slot} wallet={wallet} games={facts.games} />
    );
  return (
    <PageFrame
      back="/blitz"
      title={lobbyTitle(row)}
      tabs={false}
      foot={desktop ? undefined : action}
      painting={BLITZ.painting}
      stage
    >
      {desktop ? (
        <div className="grid grid-cols-[minmax(0,1fr)_26rem] items-start gap-6">
          <section className={cn("plate p-6", row.kind === "slot" && "justify-self-start")}>
            {row.kind === "slot" ? (
              <RegisteredCount slot={row.slot} large closed={isClosedSlot(row, facts.now)} />
            ) : (
              <RosterGrid
                seats={seatsOf(row.game, player)}
                total={row.seats.total}
                preparing={step.kind === "preparing"}
              />
            )}
          </section>
          <div className="flex flex-col gap-5">
            <section className="plate flex flex-col gap-4 p-5">
              {!isClosedSlot(row, facts.now) && <Countdown row={row} now={facts.now} />}
              {clock}
              {action}
            </section>
            {row.kind === "slot" && <SlotChat slot={row.slot} wallet={wallet} />}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {clock}
          {row.kind === "slot" ? (
            <>
              <RegisteredCount slot={row.slot} large={false} closed={isClosedSlot(row, facts.now)} />
              <SlotChat slot={row.slot} wallet={wallet} />
            </>
          ) : (
            <SeatGrid seats={seatsOf(row.game, player)} total={row.seats.total} preparing={step.kind === "preparing"} />
          )}
        </div>
      )}
    </PageFrame>
  );
};

/** The desktop lobby's large clock: the time to the start, or to the end of a live game, to the second. */
const Countdown = ({ row, now }: { row: BlitzRow; now: number }) => {
  const live = row.startsAt === null;
  const at = live ? (row.kind === "game" ? row.game.clock.end_at : undefined) : row.startsAt;
  return (
    <div className="flex flex-col gap-1">
      <span className="font-ui text-[14px] tracking-[.06em] text-kit-muted">
        {live ? BLITZ_WORDS.endsIn : BLITZ_WORDS.startsIn}
      </span>
      <span className="font-display text-[64px] leading-none text-kit-cream">
        {at === undefined || at === null ? "—" : countdown(at - now)}
      </span>
    </div>
  );
};

/** Hours, minutes and seconds left: "2:04:12"; never below zero. */
const countdown = (seconds: number) => {
  const left = Math.max(0, Math.floor(seconds));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${Math.floor(left / 3600)}:${pad(Math.floor(left / 60) % 60)}:${pad(left % 60)}`;
};

/** A slot past its close: its lobby is kept for its entry's outcome, with no start left to count down to. */
const isClosedSlot = (row: BlitzRow, now: number): boolean =>
  row.kind === "slot" && row.startsAt !== null && now >= row.startsAt;

const LobbyClock = ({ row, step, now }: { row: BlitzRow; step: LobbyStep; now: number }) => (
  <div className="flex flex-wrap items-center gap-2">
    {row.startsAt === null ? (
      <>
        <LiveChip />
        {row.kind === "game" && <ClockChip prefix="ends" at={row.game.clock.end_at} now={now} />}
      </>
    ) : isClosedSlot(row, now) ? (
      <StateChip icon="Lk" text={ENTRY_WORDS.closed} />
    ) : (
      <ClockChip prefix="starts" at={row.startsAt} now={now} />
    )}
    {step.kind === "preparing" && <StateChip icon="Ok" text={WORDS.joined} />}
    {/* A slot's lobby draws its one number large (RegisteredCount); a game's seats ride here as a chip. */}
    {step.kind !== "preparing" && row.kind === "game" && <SeatsChip row={row} />}
  </div>
);

/** The lobby's one step, or the fact standing where it would. */
const LobbyAction = ({ row, step, desktop }: { row: BlitzRow; step: LobbyStep; desktop: boolean }) => {
  const navigate = useNavigate();
  // On the desktop the step answers Enter.
  const verb = (button: ReactNode) => (desktop ? <StepVerb>{button}</StepVerb> : button);
  switch (step.kind) {
    case "open":
      return verb(
        <Button role="primary" word={BLITZ_WORDS.open} icon="Pl" onClick={() => navigate(`/blitz/${lobbyId(row)}`)} />,
      );
    case "preparing":
      return <Button role="primary" word={WORDS.enter} loading={BLITZ_WORDS.preparing} />;
    case "enter":
      return (
        row.kind === "game" &&
        verb(
          <Button role="primary" word={WORDS.enter} icon="Pl" onClick={() => navigate(entryHref(row.game, "play"))} />,
        )
      );
    case "watch":
      return (
        row.kind === "game" &&
        verb(
          <Button
            role="secondary"
            word={WORDS.watch}
            icon="Wc"
            onClick={() => navigate(entryHref(row.game, "spectate"))}
          />,
        )
      );
  }
};

/**
 * A slot's chat. Who writes is the server's decision, taken when the room opens on the payout wallet's registration in
 * the slot, so the room is opened again whenever that wallet or its registration changes.
 */
const SlotChat = ({ slot, wallet }: { slot: PlaytestSlot; wallet: PayoutWallet | null }) => {
  const ledger = environmentLedger();
  const address = wallet && wallet.status !== "no_wallet" ? wallet.address : null;
  if (!ledger || !address) return <LobbyChatPanel slot={slot} membership={chatMembershipOf(address, undefined)} />;
  return <RegistrantChat ledger={ledger} slot={slot} address={address} />;
};

const RegistrantChat = ({
  ledger,
  slot,
  address,
}: {
  ledger: EnvironmentLedger;
  slot: PlaytestSlot;
  address: string;
}) => {
  const terms = useEntryTerms(ledger, slotKeyOf(slot), address).data;
  return <LobbyChatPanel slot={slot} membership={chatMembershipOf(address, terms)} />;
};

/**
 * A slot's paid entry, on the environment's ledger under the slot's own key, from the payout wallet. A ledger not
 * deployed on this environment shows that the entry cannot be read.
 */
const SlotEntry = ({
  slot,
  wallet,
  games,
}: {
  slot: PlaytestSlot;
  wallet: PayoutWallet | null;
  games: readonly DirectoryGame[];
}) => {
  const ledger = environmentLedger();
  if (!ledger) return <FailureLine line={ENTRY_WORDS.unreadable} />;
  if (!wallet) return <FailureLine line={WALLET_WORDS.unavailableLine} />;
  const key = slotKeyOf(slot);
  const game = wallet.status === "no_wallet" ? undefined : seatedGameOf(games, key, wallet.address);
  return <PaidEntry ledger={ledger} slot={key} wallet={wallet} game={game} />;
};
