import { useEffect, useState } from "react";
import { Position, configManager } from "@bibliothecadao/eternum";
import { StructureType } from "@bibliothecadao/types";
import { useCurrentArmiesTick } from "@/hooks/helpers/use-block-timestamp";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { useLeaderboardActivity } from "@/hooks/use-leaderboard-activity";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { HUD_COLUMN_TOP, HUD_COLUMN_WIDTH } from "./hud-layout";
import { advanceStandingsTick, selectSpectatorStandings, type StandingsTick } from "./spectator-standings-model";

/** The desktop left column for a spectator: the standings table in its own fixed frame. */
export function SpectatorStandings() {
  return (
    <section
      aria-label="Spectator standings"
      className={cn(
        "fixed left-3 z-20 pointer-events-auto rounded-xl overflow-hidden",
        HUD_COLUMN_TOP,
        HUD_COLUMN_WIDTH,
        OVERLAY_SURFACE_BASE,
      )}
    >
      <SpectatorStandingsBody />
    </section>
  );
}

/** The standings table without a frame, so the desktop column and the compact sheet host the same rows. */
export function SpectatorStandingsBody() {
  return <StandingsRows key={configManager.getActiveGameId()} />;
}

function StandingsRows() {
  const { data, isError } = useLeaderboardActivity();
  const tick = useCurrentArmiesTick();
  const [history, setHistory] = useState<StandingsTick | null>(null);
  const structures = useWorldSlicesStore((state) => state.structures);
  const players = useWorldSlicesStore((state) => state.players);
  const selectedId = useUIStore((state) => state.structureEntityId);
  const navigate = useNavigateToMapView();
  useEffect(() => {
    if (data) setHistory((previous) => advanceStandingsTick(previous, tick, data));
  }, [data, tick]);
  const selectedOwner = structures.find((structure) => structure.entity_id === selectedId)?.owner;
  const rows = selectSpectatorStandings(data ?? [], selectedOwner, history);

  return (
    <>
      <div className="px-3 py-2 text-xs uppercase tracking-widest text-gold border-b border-gold/20">Standings</div>
      <div className="grid grid-cols-[2rem_1fr_4rem_3rem] px-3 py-1 text-[10px] text-gold/50">
        <span>#</span>
        <span>Player</span>
        <span className="text-right">VP</span>
        <span className="text-right">Δ tick</span>
      </div>
      {rows.map((row) => {
        const address = BigInt(row.address);
        const name =
          players.find((player) => player.address === address)?.name ??
          `${row.address.slice(0, 6)}…${row.address.slice(-4)}`;
        const capital = structures
          .filter((structure) => structure.owner === address && structure.base.category === StructureType.Realm)
          .toSorted((a, b) => a.entity_id - b.entity_id)[0];
        return (
          <button
            key={row.address}
            type="button"
            disabled={!capital}
            aria-current={row.pinned ? "true" : undefined}
            onClick={() => capital && navigate(new Position({ x: capital.base.coord_x, y: capital.base.coord_y }))}
            title={capital ? `Fly to ${name}'s capital` : "No surviving realm"}
            className={cn(
              "grid w-full grid-cols-[2rem_1fr_4rem_3rem] items-center px-3 py-2 text-xs text-gold enabled:hover:bg-gold/10 disabled:opacity-60",
              row.pinned && "bg-gold/15 border-t border-gold/30",
            )}
          >
            <span>{row.rank}</span>
            <span className="truncate text-left">{name}</span>
            <span className="text-right tabular-nums">{Math.floor(row.totalPoints).toLocaleString()}</span>
            <span className="text-right tabular-nums text-gold/60">
              {row.delta > 0 ? "+" : ""}
              {Math.floor(row.delta)}
            </span>
          </button>
        );
      })}
      {!rows.length && (
        <p className="px-3 py-4 text-xs text-gold/60">
          {isError ? "Standings unavailable" : data ? "No points scored yet" : "Loading standings…"}
        </p>
      )}
    </>
  );
}
