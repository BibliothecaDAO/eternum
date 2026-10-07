import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/ui/design-system/kit/button";
import { ReasonPlate } from "@/ui/design-system/kit/reason-plate";
import { formatClockTime } from "@/ui/design-system/kit/time";

import type { BlitzRow } from "../blitz-rows";
import { useJoinOnReturn, useJoinSlot } from "../blitz-slot";
import { ClockChip } from "../clock-chip";
import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
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
import { SeatGrid } from "./seat-grid";

const BLITZ = ageOf("blitz");

/** Blitz's facts with its Join: a Join that waited on sign-in completes here by itself. */
const useBlitz = () => {
  const facts = usePlayFacts();
  const join = useJoinSlot();
  useJoinOnReturn(join, facts.slots.data?.slots);
  // A refused Join names the service above the foot, with Try again joining the same slot.
  const refused = join.register.isError && (
    <ServiceFailure
      service="join"
      error={join.register.error}
      retry={() => join.register.variables && join.register.mutate(join.register.variables)}
    />
  );
  return { facts, join, refused };
};

/**
 * Blitz's games (spec 05): live first, then by start, each with when, its seats and one action; a row opens its
 * lobby. The age's painting heads the list on a phone and stands beside it on desktop.
 */
export const BlitzListPage = () => {
  const { facts, join, refused } = useBlitz();
  return (
    <PageFrame back="/" title={BLITZ.name} notice={refused || undefined}>
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[1fr_32rem] lg:items-start lg:gap-8">
        <AgeHeader />
        <section className="rounded-2xl border border-kit-line bg-kit-plate px-3">
          <BlitzRows facts={facts} join={join} />
        </section>
      </div>
    </PageFrame>
  );
};

const AgeHeader = () => (
  <header className="relative isolate flex h-36 items-end overflow-hidden rounded-2xl border border-kit-line p-3 lg:h-[30rem]">
    <img
      {...paintingSources(BLITZ.painting)}
      sizes="(min-width: 1024px) 50vw, 100vw"
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

const BlitzRows = ({ facts, join }: { facts: PlayFacts; join: ReturnType<typeof useJoinSlot> }) => {
  if (facts.slots.isError)
    return <ServiceFailure service="slots" error={facts.slots.error} retry={() => void facts.slots.refetch()} />;
  if (facts.directory.isError)
    return (
      <ServiceFailure service="directory" error={facts.directory.error} retry={() => void facts.directory.refetch()} />
    );
  if (!facts.slots.isSuccess || !facts.directory.isSuccess) return <Loading />;
  return (
    <ul>
      {facts.blitz.map((row) => (
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
  const row = facts.blitz.find((candidate) => lobbyId(candidate) === id);
  if (!row) {
    return (
      <PageFrame back="/blitz" title={BLITZ.name} tabs={false}>
        {facts.slots.isSuccess && facts.directory.isSuccess ? <NothingHere /> : <Loading />}
      </PageFrame>
    );
  }
  const step = lobbyStep(row, facts.blitz, join.realmsId);
  const seats = seatsOf(row, facts.slots.data?.slots ?? [], join.realmsId);
  const clock = <LobbyClock row={row} step={step} now={facts.now} />;
  const action = <LobbyAction row={row} step={step} join={join} />;
  return (
    <PageFrame
      back="/blitz"
      title={lobbyTitle(row)}
      tabs={false}
      notice={refused || undefined}
      foot={layout === "phone" ? action : undefined}
    >
      {layout === "phone" ? (
        <div className="flex flex-col gap-4">
          {clock}
          <SeatGrid seats={seats} />
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_22rem] items-start gap-8">
          <SeatGrid seats={seats} />
          <div className="flex flex-col gap-4">
            {clock}
            {action}
          </div>
        </div>
      )}
    </PageFrame>
  );
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
const LobbyAction = ({ row, step, join }: { row: BlitzRow; step: LobbyStep; join: ReturnType<typeof useJoinSlot> }) => {
  const navigate = useNavigate();
  switch (step.kind) {
    case "join":
      return (
        row.kind === "slot" && (
          <Stack>
            <p className="text-center text-[15px] text-kit-muted">{BLITZ_WORDS.seatKept}</p>
            <Button
              role="primary"
              word={WORDS.join}
              icon="Pl"
              loading={join.joining === row.slot.name ? BLITZ_WORDS.joining : undefined}
              onClick={() => join.join(row.slot)}
            />
          </Stack>
        )
      );
    case "joined":
      return null;
    case "preparing":
      return (
        <Button role="primary" word={WORDS.enter} loading={`${BLITZ_WORDS.preparing} ${step.ready}/${step.total}`} />
      );
    case "enter":
      return (
        row.kind === "game" && (
          <Button role="primary" word={WORDS.enter} icon="Pl" onClick={() => navigate(entryHref(row.game, "play"))} />
        )
      );
    case "watch":
      return (
        row.kind === "game" && (
          <Button
            role="secondary"
            word={WORDS.watch}
            icon="Wc"
            onClick={() => navigate(entryHref(row.game, "spectate"))}
          />
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
