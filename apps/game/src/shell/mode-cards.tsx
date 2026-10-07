import { canEnterGame, isGameOver } from "@/runtime/world/directory";
import { Check, Eye } from "@/ui/design-system/atoms/game-icons";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { type BlitzRow, blitzRows, leadBlitzRow } from "./blitz-rows";
import { useJoinSlot, usePlaytestSlots } from "./blitz-slot";
import { entryHref } from "./game-links";
import type { DirectoryGame } from "./herald";
import { ServiceFailure } from "./service-failure";
import { ClockChip } from "./clock-chip";
import { PlayersChip, PrimaryLink, SeatBar, UnavailableChip } from "./live-chips";
import { MODE_ART } from "./mode-art";

/**
 * A mode as a painted card (design o1, o4, o10): its art, its name, its live state as chips, and at most one action.
 * On home the card itself opens the games list (`to`); a locked mode's art is greyed.
 */
const ModeCard = ({
  art,
  name,
  locked = false,
  state,
  action,
  to,
  className,
}: {
  art: string;
  name: string;
  locked?: boolean;
  state: ReactNode;
  action?: ReactNode;
  to?: string;
  className?: string;
}) => (
  <article className={cn("relative isolate overflow-hidden rounded-2xl border border-kit-line", className)}>
    <ModeArt art={art} name={name} locked={locked} to={to} />
    <div className="pointer-events-none flex h-full flex-col justify-end gap-2 p-3 lg:p-4">
      <ModeName name={name} locked={locked} />
      <div className="flex items-center gap-2">
        {state}
        {action && <span className="pointer-events-auto ml-auto">{action}</span>}
      </div>
    </div>
  </article>
);

/** A mode's painting under its vignette, behind the card; a link to the games list where the card offers one. */
const ModeArt = ({ art, name, locked, to }: { art: string; name: string; locked: boolean; to?: string }) => {
  const painting = (
    <>
      <img src={art} alt="" className={cn("size-full object-cover", locked && "opacity-45 grayscale")} />
      <span className="absolute inset-0 bg-gradient-to-t from-kit-ground via-kit-ground/50 to-transparent" />
    </>
  );
  return to ? (
    <Link to={to} aria-label={name} className="absolute inset-0 -z-10">
      {painting}
    </Link>
  ) : (
    <div aria-hidden className="absolute inset-0 -z-10">
      {painting}
    </div>
  );
};

const ModeName = ({ name, locked = false }: { name: string; locked?: boolean }) => (
  <h3
    className={cn(
      "font-ui text-[20px] font-extrabold drop-shadow-[0_2px_0_theme(colors.kit.ink)] lg:text-[22px]",
      locked ? "text-kit-muted" : "text-kit-cream",
    )}
  >
    {name}
  </h3>
);

/** Frontier: the live season's players, and Enter; its day joins once the directory carries it. */
export const FrontierCard = ({ season, to, className }: { season: DirectoryGame; to?: string; className?: string }) => (
  <ModeCard
    art={MODE_ART.frontier}
    name="Frontier"
    to={to}
    className={className}
    state={season.error ? <UnavailableChip /> : <PlayersChip count={season.player_count} />}
    action={
      canEnterGame(season) && (
        <PrimaryLink small to={entryHref(season, "play")}>
          Enter
        </PrimaryLink>
      )
    }
  />
);

/** The Blitz rows a card draws: the directory's games and the launch service's slots, as one list. */
const useBlitzRows = (games: DirectoryGame[]) => {
  const slots = usePlaytestSlots();
  const join = useJoinSlot();
  const rows = blitzRows(games, slots.data?.slots ?? [], join.realmsId);
  return { rows, slots, join };
};

/**
 * Blitz on home (design o1, o2, o10): one row, the player's own game to enter, else the next slot's time to close,
 * its seats and Join, or a check once registered. The card opens the lobby, which lists every Blitz.
 */
export const BlitzCard = ({ games, now, className }: { games: DirectoryGame[]; now: number; className?: string }) => {
  const { rows, slots, join } = useBlitzRows(games);
  const lead = leadBlitzRow(rows);
  return (
    <ModeCard
      art={MODE_ART.blitz}
      name="Blitz"
      to="/play"
      className={className}
      // Unknown while the slots load; with nothing to play or join there is nothing to show.
      state={
        lead ? (
          <BlitzRowState row={lead} now={now} />
        ) : (
          !slots.data && <ClockChip prefix="starts" at={undefined} now={now} />
        )
      }
      action={lead && <BlitzRowAction row={lead} join={join} />}
    />
  );
};

/**
 * Blitz in the lobby (design o4, o12): the arena's painting over every Blitz as a row, live games first, then games
 * about to start, then the slots still filling. A row is its state, its seats and one action.
 */
export const BlitzLobbyCard = ({
  games,
  now,
  className,
}: {
  games: DirectoryGame[];
  now: number;
  className?: string;
}) => {
  const { rows, slots, join } = useBlitzRows(games);
  // With no game to play or watch and no slot filling, Blitz is closed for now, greyed like Eternum before it opens.
  if (rows.length === 0 && slots.isSuccess) {
    return <ModeCard art={MODE_ART.blitz} name="Blitz" locked state={null} className={cn("h-32 lg:h-40", className)} />;
  }
  return (
    <article className={cn("overflow-hidden rounded-2xl border border-kit-line bg-kit-plate", className)}>
      <div className="relative isolate flex h-32 items-end p-3 lg:h-44 lg:p-4">
        <ModeArt art={MODE_ART.blitz} name="Blitz" locked={false} />
        <ModeName name="Blitz" />
      </div>
      {slots.isError && <ServiceFailure service="slots" error={slots.error} retry={() => void slots.refetch()} />}
      {join.register.isError && (
        <ServiceFailure service="slots" error={join.register.error} retry={() => join.register.reset()} />
      )}
      <ul className="divide-y divide-kit-plate2">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-3 px-3 py-2.5 lg:px-4">
            <BlitzRowState row={row} now={now} />
            <span className="ml-auto">
              <BlitzRowAction row={row} join={join} />
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
};

/** A row's state: the live dot, or the time until it starts or its slot closes; then its seats. */
const BlitzRowState = ({ row, now }: { row: BlitzRow; now: number }) => (
  <span className="flex min-w-0 items-center gap-3">
    {row.kind === "game" && row.game.error ? (
      <UnavailableChip />
    ) : row.kind === "game" && row.game.status === "Ended" ? (
      <span className="font-ui text-[15px] font-extrabold text-kit-cream">Ended</span>
    ) : row.startsAt === null ? (
      <span className="flex items-center gap-2 font-ui text-[15px] font-extrabold text-kit-cream">
        <span aria-hidden className="size-2.5 rounded-full bg-kit-sage shadow-[0_0_8px_theme(colors.kit.sage)]" />
        Live
      </span>
    ) : (
      <ClockChip prefix="starts" at={row.startsAt} now={now} />
    )}
    <SeatBar filled={row.seats.filled} total={row.seats.total} />
  </span>
);

/** A row's one action: Enter the player's game, watch one (the eye), Join a slot, or the check of a seat taken. */
const BlitzRowAction = ({ row, join }: { row: BlitzRow; join: ReturnType<typeof useJoinSlot> }) => {
  switch (row.action) {
    case "enter":
      return (
        row.kind === "game" && (
          <PrimaryLink small to={entryHref(row.game, "play")}>
            Enter
          </PrimaryLink>
        )
      );
    case "spectate":
      return (
        row.kind === "game" && (
          <Link
            to={entryHref(row.game, "spectate")}
            aria-label="Spectate"
            className="frontier-chip size-11 justify-center !p-0"
          >
            <Eye className="!size-6" />
          </Link>
        )
      );
    case "join":
      return (
        row.kind === "slot" && (
          <button
            type="button"
            disabled={join.register.isPending}
            onClick={() => join.join(row.slot)}
            className="frontier-primary !h-11 !rounded-xl px-5 !text-[17px]"
          >
            Join
          </button>
        )
      );
    case "registered":
      return (
        <span aria-label="Registered" className="frontier-chip size-11 justify-center !p-0">
          <Check className="!size-6" />
        </span>
      );
  }
};

/** Eternum: greyed until its next game opens, with the time left to it; Enter once one is open to the player. */
export const EternumCard = ({
  games,
  now,
  to,
  className,
}: {
  games: DirectoryGame[];
  now: number;
  to?: string;
  className?: string;
}) => {
  const next = games
    .filter((game) => game.mode === "eternum" && !isGameOver(game))
    .toSorted((a, b) => a.clock.start_main_at - b.clock.start_main_at)[0];
  const open = next !== undefined && canEnterGame(next);
  return (
    <ModeCard
      art={MODE_ART.eternum}
      name="Eternum"
      locked={!open}
      to={to}
      className={className}
      state={
        next?.error ? (
          <UnavailableChip />
        ) : (
          next &&
          !open &&
          next.clock.start_main_at > now && <ClockChip prefix="opens" at={next.clock.start_main_at} now={now} />
        )
      }
      action={
        open && (
          <PrimaryLink small to={entryHref(next, "play")}>
            Enter
          </PrimaryLink>
        )
      }
    />
  );
};
