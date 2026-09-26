import { canEnterGame, isGameOver } from "@/runtime/world/directory";
import { Check } from "@/ui/design-system/atoms/game-icons";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { BLITZ_SEATS, nextOpenSlot, registrationFor, seatsFilling, useJoinSlot, usePlaytestSlots } from "./blitz-slot";
import { entryHref } from "./game-links";
import type { DirectoryGame } from "./herald";
import { PlayersChip, PrimaryLink, SeatBar, TimeLeftChip } from "./live-chips";
import { MODE_ART } from "./mode-art";

/**
 * A mode as a painted card (design o1, o10): its art, its name, its live state as chips, and at most one action. The
 * card itself opens the games list; a locked mode's art is greyed.
 */
const ModeCard = ({
  art,
  name,
  locked = false,
  state,
  action,
  className,
}: {
  art: string;
  name: string;
  locked?: boolean;
  state: ReactNode;
  action?: ReactNode;
  className?: string;
}) => (
  <article className={cn("relative isolate overflow-hidden rounded-2xl border border-[#46351c]", className)}>
    <Link to="/play" aria-label={name} className="absolute inset-0 -z-10">
      <img src={art} alt="" className={cn("size-full object-cover", locked && "opacity-45 grayscale")} />
      <span className="absolute inset-0 bg-gradient-to-t from-[#0c0a08] via-[#0c0a08]/50 to-transparent" />
    </Link>
    <div className="pointer-events-none flex h-full flex-col justify-end gap-2 p-3 lg:p-4">
      <h3
        className={cn(
          "font-[Lexend] text-[20px] font-extrabold drop-shadow-[0_2px_0_#1b1207] lg:text-[22px]",
          locked ? "text-[#a2926f]" : "text-[#fff3c4]",
        )}
      >
        {name}
      </h3>
      <div className="flex items-center gap-2">
        {state}
        {action && <span className="pointer-events-auto ml-auto">{action}</span>}
      </div>
    </div>
  </article>
);

/** Frontier: the live season's players, and Enter; its day joins once the directory carries it. */
export const FrontierCard = ({ season, className }: { season: DirectoryGame; className?: string }) => (
  <ModeCard
    art={MODE_ART.frontier}
    name="Frontier"
    className={className}
    state={<PlayersChip count={season.player_count} />}
    action={
      canEnterGame(season) && (
        <PrimaryLink small to={entryHref(season, "play")}>
          Enter
        </PrimaryLink>
      )
    }
  />
);

/**
 * Blitz: the next slot's time to close and its seats filling, and one action: Join, or a check once the player is
 * registered. A Blitz the player is playing now offers Enter instead.
 */
export const BlitzCard = ({ games, now, className }: { games: DirectoryGame[]; now: number; className?: string }) => {
  const slots = usePlaytestSlots();
  const { join, register, realmsId } = useJoinSlot();
  // A Blitz the player is on the roster of, running now, is theirs to enter before any slot to join.
  const playing = games.find((game) => game.mode === "blitz" && canEnterGame(game));
  const slot = slots.data && nextOpenSlot(slots.data.slots);
  const registered = slot && registrationFor(slot, realmsId);
  if (playing)
    return (
      <ModeCard
        art={MODE_ART.blitz}
        name="Blitz"
        className={className}
        state={<PlayersChip count={playing.player_count} />}
        action={
          <PrimaryLink small to={entryHref(playing, "play")}>
            Enter
          </PrimaryLink>
        }
      />
    );
  return (
    <ModeCard
      art={MODE_ART.blitz}
      name="Blitz"
      className={className}
      state={
        <>
          {/* Unknown while the slots load; with none open there is nothing to count down to. */}
          {(!slots.data || slot) && (
            <TimeLeftChip seconds={slot && Math.floor(Date.parse(slot.closesAt) / 1000) - now} />
          )}
          {slot && <SeatBar filled={seatsFilling(slot)} total={BLITZ_SEATS} />}
        </>
      }
      action={
        slot &&
        (registered ? (
          <span aria-label="Registered" className="frontier-chip size-11 justify-center !p-0">
            <Check className="!size-6" />
          </span>
        ) : (
          <button
            type="button"
            disabled={register.isPending}
            onClick={() => join(slot)}
            className="frontier-primary !h-11 !rounded-xl px-5 !text-[17px]"
          >
            Join
          </button>
        ))
      }
    />
  );
};

/** Eternum: greyed until its next game opens, with the time left to it; Enter once one is open to the player. */
export const EternumCard = ({ games, now, className }: { games: DirectoryGame[]; now: number; className?: string }) => {
  const next = games
    .filter((game) => game.mode === "eternum" && !isGameOver(game))
    .toSorted((a, b) => a.clock.start_main_at - b.clock.start_main_at)[0];
  const open = next !== undefined && canEnterGame(next);
  return (
    <ModeCard
      art={MODE_ART.eternum}
      name="Eternum"
      locked={!open}
      className={className}
      state={
        next && !open && next.clock.start_main_at > now && <TimeLeftChip seconds={next.clock.start_main_at - now} />
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
