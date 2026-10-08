import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Button } from "@/ui/design-system/kit/button";
import { ReasonPlate } from "@/ui/design-system/kit/reason-plate";
import { formatClockTime } from "@/ui/design-system/kit/time";

import type { BlitzRow } from "../blitz-rows";
import { useJoinOnReturn, useJoinSlot } from "../blitz-slot";
import { ClockChip } from "../clock-chip";
import { useLayout } from "../frame/layout";
import { useRealmsPlayer } from "../herald";
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
import { BLITZ_WORDS, WORDS } from "../words";
import { GameRow, SeatsChip } from "./game-row";
import { type LobbyStep, lobbyId, lobbyStep, lobbyTitle, seatsOf } from "./lobby";
import { LobbyChatPanel } from "./lobby-chat-panel";
import { RosterGrid, SeatGrid } from "./seat-grid";

const BLITZ = ageOf("blitz");

/** Blitz's Join where its rows are drawn: a Join that waited on sign-in completes here by itself. */
export const useBlitzJoin = (slots: Parameters<typeof useJoinOnReturn>[1]) => {
  const join = useJoinSlot();
  useJoinOnReturn(join, slots);
  // A refused Join names the service in the page's notice, with Try again joining the same slot.
  const refused = join.register.isError && (
    <ServiceFailure
      service="join"
      error={join.register.error}
      retry={() => join.register.variables && join.register.mutate(join.register.variables)}
    />
  );
  return { join, refused };
};

const useBlitz = () => {
  const facts = usePlayFacts();
  return { facts, ...useBlitzJoin(facts.slots.data?.slots) };
};

/**
 * Blitz's games (spec 05): live first, then by start, each with when, its seats and one action; a row opens its
 * lobby. The age's painting heads the list on a phone; the desktop stands the list on it, the next filling game's
 * lobby beside it.
 */
export const BlitzListPage = () => {
  const { facts, join, refused } = useBlitz();
  const desktop = useLayout() === "desktop";
  const rows = (
    <section className="plate px-3">
      <BlitzRows facts={facts} join={join} />
    </section>
  );
  return (
    <PageFrame back="/" title={BLITZ.name} notice={refused || undefined} painting={BLITZ.painting} stage>
      {desktop ? (
        <div className="grid grid-cols-[minmax(0,1fr)_34rem] items-start gap-6">
          {rows}
          <NextLobby facts={facts} join={join} />
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

/** Beside the desktop's rows: the next game filling its seats, as its lobby shows it, with its one step. */
const NextLobby = ({ facts, join }: { facts: PlayFacts; join: ReturnType<typeof useJoinSlot> }) => {
  const { data: player } = useRealmsPlayer();
  const row = facts.blitz.find((candidate) => candidate.kind === "slot");
  if (!row) return null;
  const step = lobbyStep(row, facts.blitz, join.realmsId);
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
      <SeatGrid seats={seatsOf(row, join.realmsId, player)} preparing={false} />
      <LobbyAction row={row} step={step} join={join} desktop />
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
export const BlitzRows = ({
  facts,
  join,
  limit,
}: {
  facts: PlayFacts;
  join: ReturnType<typeof useJoinSlot>;
  limit?: number;
}) => {
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
        <GameRow key={row.key} row={row} now={facts.now} join={join} />
      ))}
    </ul>
  );
};

/**
 * One Blitz before it starts (spec 06): its clock, its 24 sockets with the player's own ringed, and one step: Join
 * (with its cost above it), nothing while a joined player waits, Preparing until the roster's realms are ready, then
 * Enter. There is no way out of a seat (ruled).
 */
export const BlitzLobbyPage = () => {
  const { id } = useParams();
  const { facts, join, refused } = useBlitz();
  const layout = useLayout();
  const { data: player } = useRealmsPlayer();
  const row = facts.blitz.find((candidate) => lobbyId(candidate) === id);
  if (!row) {
    return (
      <PageFrame back="/blitz" title={BLITZ.name} tabs={false}>
        {facts.slots.isSuccess && facts.directory.isSuccess ? <NothingHere /> : <Loading />}
      </PageFrame>
    );
  }
  const step = lobbyStep(row, facts.blitz, join.realmsId);
  const seats = seatsOf(row, join.realmsId, player);
  const clock = <LobbyClock row={row} step={step} now={facts.now} />;
  const desktop = layout === "desktop";
  const action = <LobbyAction row={row} step={step} join={join} desktop={desktop} />;
  return (
    <PageFrame
      back="/blitz"
      title={lobbyTitle(row)}
      tabs={false}
      notice={refused || undefined}
      foot={desktop ? undefined : action}
      painting={BLITZ.painting}
      stage
    >
      {desktop ? (
        <div className="grid grid-cols-[minmax(0,1fr)_26rem] items-start gap-6">
          <section className="plate p-6">
            <RosterGrid seats={seats} preparing={step.kind === "preparing"} />
          </section>
          <div className="flex flex-col gap-5">
            <section className="plate flex flex-col gap-4 p-5">
              <Countdown row={row} now={facts.now} />
              {clock}
              {action}
            </section>
            {row.kind === "slot" && <LobbyChatPanel slotName={row.slot.name} seated={step.kind === "joined"} />}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {clock}
          <SeatGrid seats={seats} preparing={step.kind === "preparing"} />
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

const LobbyClock = ({ row, step, now }: { row: BlitzRow; step: LobbyStep; now: number }) => (
  <div className="flex flex-wrap items-center gap-2">
    {row.startsAt === null ? (
      <>
        <LiveChip />
        {row.kind === "game" && <ClockChip prefix="ends" at={row.game.clock.end_at} now={now} />}
      </>
    ) : (
      <ClockChip prefix="starts" at={row.startsAt} now={now} />
    )}
    {step.kind === "joined" || step.kind === "preparing" ? (
      <StateChip icon="Ok" text={WORDS.joined} />
    ) : (
      <SeatsChip seats={row.seats} />
    )}
  </div>
);

/** The lobby's one step, or the fact standing where it would. */
const LobbyAction = ({
  row,
  step,
  join,
  desktop,
}: {
  row: BlitzRow;
  step: LobbyStep;
  join: ReturnType<typeof useJoinSlot>;
  desktop: boolean;
}) => {
  const navigate = useNavigate();
  // On the desktop the step answers Enter.
  const verb = (button: ReactNode) => (desktop ? <StepVerb>{button}</StepVerb> : button);
  switch (step.kind) {
    case "join":
      return (
        row.kind === "slot" && (
          <Stack>
            <p className="text-center text-[15px] text-kit-muted">{BLITZ_WORDS.seatKept}</p>
            {verb(
              <Button
                role="primary"
                word={WORDS.join}
                icon="Pl"
                loading={join.joining === row.slot.name ? BLITZ_WORDS.joining : undefined}
                onClick={() => join.join(row.slot)}
              />,
            )}
          </Stack>
        )
      );
    case "joined":
      return null;
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
    case "full": {
      const next = step.next;
      const nextStart = formatClockTime(next?.startsAt ?? undefined);
      return (
        <ReasonPlate
          reason={{ kind: "failed", line: BLITZ_WORDS.full(nextStart) }}
          step={
            next && (
              <Button role="outline" word={nextStart} icon="Hg" onClick={() => navigate(`/blitz/${lobbyId(next)}`)} />
            )
          }
        />
      );
    }
  }
};

const Stack = ({ children }: { children: ReactNode }) => <div className="flex flex-col gap-2">{children}</div>;
