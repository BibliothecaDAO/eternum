import { BLITZ_WORDS, ENTRY_WORDS, WORDS } from "@/ui/design-system/kit/words";
import { formatCountdown } from "@bibliothecadao/types";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { payoutAddressOf } from "@/hooks/context/payout-wallet";
import { useIdentitySession } from "@/hooks/context/identity-session";
import { AppButton, AppChip, AppPanel } from "@/ui/design-system/kit/app-elements";

import type { PlaytestSlot } from "../blitz-slot";

import { type BlitzRow, seatedGameOf, slotKeyOf } from "../blitz-rows";
import { useLayout } from "../frame/layout";
import { type DirectoryGame, useRealmsPlayer } from "../herald";
import { PageFrame } from "../frame/page-frame";
import { entryHref } from "../game-links";
import { Loading } from "../loading";
import { NothingHere } from "../not-found";
import { ageOf } from "../play/ages";
import { usePlayFacts } from "../play/play-facts";
import { FailureLine } from "../sign-in/failure-line";
import { type EnvironmentLedger, environmentLedger } from "../value/ledger";
import { chatMembershipOf, useEntryTerms } from "./entry";
import { PaidEntry, SignInToJoin } from "./entry-panel";
import { SeatsChip } from "./seats-chip";
import { type LobbyStep, lobbyId, lobbyRowOf, lobbyStep, lobbyTitle, seatsOf } from "./lobby";
import { LobbyChatPanel } from "./lobby-chat-panel";
import { RegisteredCount, RosterGrid, SeatGrid } from "./seat-grid";

const BLITZ = ageOf("blitz");

/**
 * One Blitz before it starts (the owner's pick, C · Ledger): its title with what stands and its one clock at the head's
 * end, then who is in, its one step, and a slot's chat, side by side. A slot shows its registered count and its paid
 * entry; a launched game its seats with the player's own ringed, Preparing until the roster's realms are ready, then
 * Enter. A phone stacks them, its step in the foot row. There is no way out of a seat (ruled).
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
  const chips = <LobbyChips row={row} step={step} now={facts.now} />;
  const wallet = session ? payoutAddressOf(session.user) : null;
  const action =
    row.kind === "game" ? (
      <LobbyAction row={row} step={step} />
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
      aside={chips}
      tabs={false}
      foot={desktop ? undefined : action}
      painting={BLITZ.painting}
    >
      {/* The Ledger's three columns from 1280px; narrower, who is in and the entry share the width, the chat under them. */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 xl:grid-cols-12">
        {!desktop && chips}
        <AppPanel title={BLITZ_WORDS.whoIsIn} icon="people" className="xl:col-span-5">
          {row.kind === "slot" ? (
            <RegisteredCount slot={row.slot} closed={isClosedSlot(row, facts.now)} />
          ) : desktop ? (
            <RosterGrid
              seats={seatsOf(row.game, player)}
              total={row.seats.total}
              preparing={step.kind === "preparing"}
            />
          ) : (
            <SeatGrid seats={seatsOf(row.game, player)} total={row.seats.total} preparing={step.kind === "preparing"} />
          )}
        </AppPanel>
        {desktop && <div className="xl:col-span-4">{row.kind === "game" ? <AppPanel>{action}</AppPanel> : action}</div>}
        {row.kind === "slot" && (
          <div className="lg:col-span-2 xl:col-span-3">
            <SlotChat slot={row.slot} wallet={wallet} />
          </div>
        )}
      </div>
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

/** The countdown's words, to the second: "Entry closes in 0:59:12". */
const COUNTDOWN_WORDS = { closes: BLITZ_WORDS.closesIn, starts: BLITZ_WORDS.startsIn, ends: BLITZ_WORDS.endsIn };

/** What stands of the lobby, as its chips: Live, Entry closed, Joined while the game is prepared, a game's seats, and its one clock. */
const LobbyChips = ({ row, step, now }: { row: BlitzRow; step: LobbyStep; now: number }) => {
  const moment = nextMoment(row, now);
  return (
    <span className="flex flex-wrap items-center gap-2">
      {row.startsAt === null && (
        <AppChip tone="good" live>
          {WORDS.live}
        </AppChip>
      )}
      {isClosedSlot(row, now) && <AppChip icon="lock">{ENTRY_WORDS.closed}</AppChip>}
      {step.kind === "preparing" && <AppChip icon="check">{WORDS.joined}</AppChip>}
      {step.kind !== "preparing" && row.kind === "game" && <SeatsChip row={row} />}
      {moment && (
        <AppChip icon="hourglass" tone={moment.prefix === "closes" ? "warn" : undefined}>
          <span role="timer">{`${COUNTDOWN_WORDS[moment.prefix]} ${formatCountdown(moment.at - now)}`}</span>
        </AppChip>
      )}
    </span>
  );
};

/** The lobby's one step, or the fact standing where it would; Enter presses it on a desktop. */
const LobbyAction = ({ row, step }: { row: BlitzRow; step: LobbyStep }) => {
  const navigate = useNavigate();
  switch (step.kind) {
    case "open":
      return (
        <AppButton kind="primary" size="lg" icon="plus" step onClick={() => navigate(`/blitz/${lobbyId(row)}`)}>
          {BLITZ_WORDS.join}
        </AppButton>
      );
    case "preparing":
      return <AppButton kind="primary" size="lg" busy={BLITZ_WORDS.preparing} />;
    case "enter":
      return (
        row.kind === "game" && (
          <AppButton kind="primary" size="lg" icon="play" step onClick={() => navigate(entryHref(row.game, "play"))}>
            {WORDS.enter}
          </AppButton>
        )
      );
    case "watch":
      return (
        row.kind === "game" && (
          <AppButton
            kind="secondary"
            size="lg"
            icon="watch"
            step
            onClick={() => navigate(entryHref(row.game, "spectate"))}
          >
            {WORDS.watch}
          </AppButton>
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
