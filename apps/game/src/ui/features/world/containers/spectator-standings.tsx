import { useMemo, useState } from "react";
import { Position, configManager, structureMapPosition } from "@bibliothecadao/eternum";
import { StructureType } from "@bibliothecadao/types";
import { useCurrentArmiesTick } from "@/hooks/helpers/use-block-timestamp";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useGame } from "@/hooks/context/game-context";
import { useFactView } from "@/hooks/use-fact-view";
import { usePlayers } from "@/hooks/use-player-profile";
import { gameStructuresView } from "@/sync/fact-views";
import { displayPlayerName } from "@bibliothecadao/eternum";
import { useInGameLeaderboard } from "@/ui/features/social/player/use-in-game-leaderboard";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { advanceStandingsTick, selectSpectatorStandings, type StandingsTick } from "./spectator-standings-model";

/** Standings fit the desktop rail or phone Holdings panel that hosts them. */
export function SpectatorStandings() {
  return (
    <section
      aria-label="Spectator standings"
      className={cn("w-full pointer-events-auto rounded-xl overflow-hidden", OVERLAY_SURFACE_BASE)}
    >
      <StandingsRows key={configManager.getActiveGameId()} />
    </section>
  );
}

function StandingsRows() {
  const { standingsByAddress } = useInGameLeaderboard();
  const standings = useMemo(
    () =>
      [...standingsByAddress.entries()].map(([address, standing]) => ({
        address,
        rank: standing.rank,
        totalPoints: standing.points,
      })),
    [standingsByAddress],
  );
  const tick = useCurrentArmiesTick();
  const [history, setHistory] = useState<{ tick: number; entries: typeof standings; snapshot: StandingsTick }>({
    tick,
    entries: standings,
    snapshot: advanceStandingsTick(null, tick, standings),
  });
  const structures = useFactView(gameStructuresView);
  const {
    setup: { store },
  } = useGame();
  const players = usePlayers();
  const selectedId = useUIStore((state) => state.structureEntityId);
  const navigate = useNavigateToMapView();
  if (history.tick !== tick || history.entries !== standings)
    setHistory({ tick, entries: standings, snapshot: advanceStandingsTick(history.snapshot, tick, standings) });
  const selectedOwner = structures.find((structure) => structure.entity_id === BigInt(selectedId))?.owner;
  const rows = selectSpectatorStandings(standings, selectedOwner, history.snapshot);

  return (
    <>
      <div className="px-3 py-2 text-sm text-gold border-b border-gold/20">Standings</div>
      <div className="grid grid-cols-[2rem_1fr_4rem_3rem] px-3 py-1 text-sm text-kit-muted">
        <span>#</span>
        <span>Player</span>
        <span className="text-right">VP</span>
        <span className="text-right">Δ tick</span>
      </div>
      {rows.map((row) => {
        const address = BigInt(row.address);
        const name = displayPlayerName(address, players.find((player) => player.address === address)?.name);
        const capital = structures
          .filter((structure) => structure.owner === address && structure.base.category === StructureType.Realm)
          .toSorted((a, b) => (a.entity_id < b.entity_id ? -1 : 1))[0];
        return (
          <button
            key={row.address}
            type="button"
            disabled={!capital}
            aria-current={row.pinned ? "true" : undefined}
            onClick={() => {
              const site = capital && structureMapPosition(store, capital);
              if (site) navigate(Position.fromContract(site));
            }}
            title={capital ? `Fly to ${name}'s capital` : "No surviving realm"}
            className={cn(
              "grid w-full grid-cols-[2rem_1fr_4rem_3rem] items-center px-3 py-2 font-sans text-sm text-gold enabled:hover:bg-gold/10 disabled:opacity-60",
              row.pinned && "bg-gold/15 border-t border-gold/30",
            )}
          >
            <span>{row.rank}</span>
            <span className="truncate text-left">{name}</span>
            <span className="text-right tabular-nums">{Math.floor(row.totalPoints).toLocaleString()}</span>
            <span className="text-right tabular-nums text-kit-muted">
              {row.delta > 0 ? "+" : ""}
              {Math.floor(row.delta)}
            </span>
          </button>
        );
      })}
      {!rows.length && <p className="px-3 py-4 text-sm text-kit-muted">No points scored yet</p>}
    </>
  );
}
