import { type ReactNode, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { payoutAddressOf } from "@/hooks/context/payout-wallet";
import { useIdentitySession } from "@/hooks/context/identity-session";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Button } from "@/ui/design-system/kit/button";
import { Pill } from "@/ui/design-system/kit/pill";

import type { PlaytestSlot } from "../blitz-slot";

import { type BlitzRow, seatedGameOf, slotKeyOf } from "../blitz-rows";
import { ClockChip } from "../clock-chip";
import { useLayout } from "../frame/layout";
import { type DirectoryGame, useRealmsPlayer } from "../herald";
import { PageFrame } from "../frame/page-frame";
import { StepVerb } from "../frame/step-verb";
import { entryHref } from "../game-links";
import { Loading } from "../loading";
import { NothingHere } from "../not-found";
import { ageOf } from "../play/ages";
import { usePlayFacts } from "../play/play-facts";
import { FailureLine } from "../sign-in/failure-line";
import { type EnvironmentLedger, environmentLedger } from "../value/ledger";
import { BLITZ_WORDS, ENTRY_WORDS, WORDS } from "../words";
import { chatMembershipOf, useEntryTerms } from "./entry";
import { PaidEntry, SignInToJoin } from "./entry-panel";
import { SeatsChip } from "./seats-chip";
import { type LobbyStep, lobbyId, lobbyRowOf, lobbyStep, lobbyTitle, seatsOf } from "./lobby";
import { LobbyChatPanel } from "./lobby-chat-panel";
import { RegisteredCount, RosterGrid, SeatGrid } from "./seat-grid";

const BLITZ = ageOf("blitz");

/**
 * One Blitz before it starts (spec 06): its one clock and one step. A slot shows its registered count and its paid entry; a
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
      <PageFrame back="/" title={BLITZ.name} tabs={false}>
        {facts.slots.isSuccess && facts.directory.isSuccess ? <NothingHere /> : <Loading />}
      </PageFrame>
    );
  }
  const step = lobbyStep(row);
  const desktop = layout === "desktop";
  const clock = <LobbyClock row={row} step={step} now={facts.now} large={desktop} />;
  const wallet = session ? payoutAddressOf(session.user) : null;
  const action =
    row.kind === "game" ? (
      <LobbyAction row={row} step={step} desktop={desktop} />
    ) : (
      <SlotEntry
        key={row.slot.name}
        slot={row.slot}
        signedIn={session !== null}
        wallet={wallet}
        owed={facts.refunds.get(row.slot.name)}
        games={facts.games}
      />
    );
  return (
    <PageFrame
      back="/"
      title={lobbyTitle(row)}
      tabs={false}
      foot={desktop ? undefined : action}
      painting={BLITZ.painting}
      stage
    >
      {desktop ? (
        <div className="grid grid-cols-[minmax(0,1fr)_theme(width.rail)] items-start gap-6">
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

/**
 * The one moment a lobby counts down to, the next that matters: a slot's close while it takes players, then its games'
 * start; a game's start, then its end once it is live. A slot whose games have started counts to nothing. The lobby's
 * title already names the start, so the clock never repeats it beside the close.
 */
const nextMoment = (row: BlitzRow, now: number): { prefix: "closes" | "starts" | "ends"; at: number } | null => {
  if (row.kind === "slot") {
    if (now < row.closesAt) return { prefix: "closes", at: row.closesAt };
    return row.startsAt !== null && now < row.startsAt ? { prefix: "starts", at: row.startsAt } : null;
  }
  return row.startsAt === null ? { prefix: "ends", at: row.game.clock.end_at } : { prefix: "starts", at: row.startsAt };
};

/** A slot whose registration has closed: its lobby is kept for its entry's outcome. */
const isClosedSlot = (row: BlitzRow, now: number): boolean => row.kind === "slot" && now >= row.closesAt;

/** The desktop's countdown words, to the second: "Entry closes in 0:59:12". */
const COUNTDOWN_WORDS = { closes: BLITZ_WORDS.closesIn, starts: BLITZ_WORDS.startsIn, ends: BLITZ_WORDS.endsIn };

/** Hours, minutes and seconds left: "2:04:12"; never below zero. */
const countdown = (seconds: number) => {
  const left = Math.max(0, Math.floor(seconds));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${Math.floor(left / 3600)}:${pad(Math.floor(left / 60) % 60)}:${pad(left % 60)}`;
};

/**
 * The lobby's one clock (large on desktop, a chip on a phone), with what stands beside it: Live, Entry closed, Joined
 * while the seat's game is prepared, a game's seats.
 */
const LobbyClock = ({ row, step, now, large }: { row: BlitzRow; step: LobbyStep; now: number; large: boolean }) => {
  const moment = nextMoment(row, now);
  return (
    <div className="flex flex-col gap-3">
      {large && moment && (
        <div className="flex flex-col gap-1">
          <span className="font-ui text-caption leading-normal tracking-[.06em] text-kit-muted">
            {COUNTDOWN_WORDS[moment.prefix]}
          </span>
          <span className="font-display text-figure leading-none text-kit-cream">{countdown(moment.at - now)}</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {row.startsAt === null && <Pill tone="live">{WORDS.live}</Pill>}
        {isClosedSlot(row, now) && <Pill icon="lock">{ENTRY_WORDS.closed}</Pill>}
        {!large && moment && <ClockChip prefix={moment.prefix} at={moment.at} now={now} />}
        {step.kind === "preparing" && <Pill icon="check">{WORDS.joined}</Pill>}
        {/* A slot's lobby draws its one number large (RegisteredCount); a game's seats ride here as a chip. */}
        {step.kind !== "preparing" && row.kind === "game" && <SeatsChip row={row} />}
      </div>
    </div>
  );
};

/** The lobby's one step, or the fact standing where it would. */
const LobbyAction = ({ row, step, desktop }: { row: BlitzRow; step: LobbyStep; desktop: boolean }) => {
  const navigate = useNavigate();
  // On the desktop the step answers Enter.
  const verb = (button: ReactNode) => (desktop ? <StepVerb>{button}</StepVerb> : button);
  switch (step.kind) {
    case "open":
      return verb(
        <Button
          role="primary"
          word={BLITZ_WORDS.join}
          icon="play"
          onClick={() => navigate(`/blitz/${lobbyId(row)}`)}
        />,
      );
    case "preparing":
      return <Button role="primary" word={WORDS.enter} loading={BLITZ_WORDS.preparing} />;
    case "enter":
      return (
        row.kind === "game" &&
        verb(
          <Button
            role="primary"
            word={WORDS.enter}
            icon="play"
            onClick={() => navigate(entryHref(row.game, "play"))}
          />,
        )
      );
    case "watch":
      return (
        row.kind === "game" &&
        verb(
          <Button
            role="secondary"
            word={WORDS.watch}
            icon="watch"
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
const SlotChat = ({ slot, wallet }: { slot: PlaytestSlot; wallet: string | null }) => {
  const ledger = environmentLedger();
  if (!ledger || !wallet) return <LobbyChatPanel slot={slot} membership={chatMembershipOf(wallet, undefined)} />;
  return <RegistrantChat ledger={ledger} slot={slot} address={wallet} />;
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
  return <LobbyChatPanel slot={slot} membership={chatMembershipOf(address, terms ?? undefined)} />;
};

/**
 * A slot's paid entry, on the environment's ledger under the slot's own key, from the payout wallet; a closed slot that
 * owes a refund reads it for the wallet owed (`owed`), which may be one the player has since replaced. A ledger not
 * deployed on this environment shows that the entry cannot be read.
 */
const SlotEntry = ({
  slot,
  signedIn,
  wallet,
  owed,
  games,
}: {
  slot: PlaytestSlot;
  signedIn: boolean;
  /** The payout wallet's address; null when the player has linked none. */
  wallet: string | null;
  owed: string | undefined;
  games: readonly DirectoryGame[];
}) => {
  // The wallet a refund was found for stays the entry's wallet once the refund is taken, so the panel shows it back; the
  // lobby keys this entry by its slot, so another slot's lobby starts without it.
  const [refundWallet, setRefundWallet] = useState(owed);
  if (owed && owed !== refundWallet) setRefundWallet(owed);
  const ledger = environmentLedger();
  if (!ledger) return <FailureLine line={ENTRY_WORDS.unreadable} />;
  if (!signedIn) return <SignInToJoin />;
  const key = slotKeyOf(slot);
  const owner = refundWallet ?? wallet;
  const game = owner ? seatedGameOf(games, key, owner) : undefined;
  return <PaidEntry ledger={ledger} slot={key} owner={owner} game={game} />;
};
