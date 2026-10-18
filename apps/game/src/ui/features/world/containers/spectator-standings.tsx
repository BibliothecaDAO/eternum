import { useEffect, useMemo, useState } from "react";
import { Position, configManager, structureMapPosition } from "@bibliothecadao/eternum";
import { StructureType, formatExact } from "@bibliothecadao/types";
import { useCurrentArmiesTick } from "@/hooks/helpers/use-block-timestamp";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useGame } from "@/hooks/context/game-context";
import { useFactView } from "@/hooks/use-fact-view";
import { usePlayers } from "@/hooks/use-player-profile";
import { gameStructuresView } from "@/sync/fact-views";
import { displayPlayerName } from "@bibliothecadao/eternum";
import { useInGameLeaderboard } from "@/ui/features/social/player/use-in-game-leaderboard";
import { HudTableHead, HudTableRow } from "@/ui/design-system/kit/hud-elements";
import { advanceStandingsTick, selectSpectatorStandings, type StandingsTick } from "./spectator-standings-model";

/** Rank, player, points and the last tick's change. */
const STANDINGS_COLS = "2rem 1fr 4rem 3rem";

/** The standings table without a frame or title, so the desktop panel and the compact sheet host the same rows. */
export function SpectatorStandingsBody() {
  return <StandingsRows key={configManager.getActiveGameId()} />;
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
  const [history, setHistory] = useState<StandingsTick | null>(null);
  const structures = useFactView(gameStructuresView);
  const {
    setup: { store },
  } = useGame();
  const players = usePlayers();
  const selectedId = useUIStore((state) => state.structureEntityId);
  const navigate = useNavigateToMapView();
  useEffect(() => {
    setHistory((previous) => advanceStandingsTick(previous, tick, standings));
  }, [standings, tick]);
  const selectedOwner = structures.find((structure) => structure.entity_id === BigInt(selectedId))?.owner;
  const rows = selectSpectatorStandings(standings, selectedOwner, history);

  return (
    <>
      <HudTableHead cols={STANDINGS_COLS}>
        <span>#</span>
        <span>Player</span>
        <span className="text-right">Points</span>
        <span className="text-right">Δ tick</span>
      </HudTableHead>
      {rows.map((row) => {
        const address = BigInt(row.address);
        const name = displayPlayerName(address, players.find((player) => player.address === address)?.name);
        const capital = structures
          .filter((structure) => structure.owner === address && structure.base.category === StructureType.Realm)
          .toSorted((a, b) => (a.entity_id < b.entity_id ? -1 : 1))[0];
        return (
          <HudTableRow
            key={row.address}
            cols={STANDINGS_COLS}
            label={`${name}: ${formatExact(Math.floor(row.totalPoints))} points`}
            title={capital ? `Fly to ${name}'s capital` : "No surviving realm"}
            selected={row.pinned}
            disabled={!capital}
            onClick={() => {
              const site = capital && structureMapPosition(store, capital);
              if (site) navigate(Position.fromContract(site));
            }}
          >
            <span>{row.rank}</span>
            <span className="truncate text-left">{name}</span>
            <span className="text-right tabular-nums">{formatExact(Math.floor(row.totalPoints))}</span>
            <span className="text-right tabular-nums text-hud-muted">
              {row.delta > 0 ? "+" : ""}
              {Math.floor(row.delta)}
            </span>
          </HudTableRow>
        );
      })}
      {!rows.length && <p className="px-3 py-4 text-hud-label text-hud-muted">No points scored yet</p>}
    </>
  );
}
