import { useMemo } from "react";
import { Position, configManager, structureMapPosition } from "@bibliothecadao/eternum";
import { StructureType, formatExact } from "@bibliothecadao/types";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useGame } from "@/hooks/context/game-context";
import { useFactView } from "@/hooks/use-fact-view";
import { usePlayerNames } from "@/hooks/use-player-profile";
import { gameStructuresView } from "@/sync/fact-views";
import { useInGameLeaderboard } from "@/ui/features/social/player/use-in-game-leaderboard";
import { HudTableHead, HudTableRow } from "@/ui/design-system/kit/hud-elements";
import { YOU } from "@/ui/design-system/kit/words";
import { useRealmsPlayer } from "@/shell/herald";
import { useGameFinished } from "./top-header/game-clock";
import { selectSpectatorStandings } from "./spectator-standings-model";

/** Rank, player and points. */
const STANDINGS_COLS = "2rem 1fr 4rem";

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
  const structures = useFactView(gameStructuresView);
  const {
    setup: { store },
  } = useGame();
  // Names are read as each row draws, and the rows draw again when one lands.
  const names = usePlayerNames();
  const selectedId = useUIStore((state) => state.structureEntityId);
  const navigate = useNavigateToMapView();
  const selectedOwner = structures.find((structure) => structure.entity_id === BigInt(selectedId))?.owner;
  const viewer = useRealmsPlayer().data;
  const rows = selectSpectatorStandings(standings, { viewer, selected: selectedOwner });
  const finished = useGameFinished();

  return (
    <>
      <HudTableHead cols={STANDINGS_COLS}>
        <span>#</span>
        <span>Player</span>
        <span className="text-right">Points</span>
      </HudTableHead>
      {rows.map((row) => {
        const address = BigInt(row.address);
        const name = names.text(address);
        const shown = row.own ? YOU : name;
        const capital = structures
          .filter((structure) => structure.owner === address && structure.base.category === StructureType.Realm)
          .toSorted((a, b) => (a.entity_id < b.entity_id ? -1 : 1))[0];
        return (
          <HudTableRow
            key={row.address}
            cols={STANDINGS_COLS}
            label={`${shown}: ${formatExact(Math.floor(row.totalPoints))} points`}
            title={capital ? `Fly to ${name}'s capital` : "No surviving realm"}
            selected={row.own}
            disabled={!capital}
            onClick={() => {
              const site = capital && structureMapPosition(store, capital);
              if (site) navigate(Position.fromContract(site));
            }}
          >
            <span>{row.rank}</span>
            <span className="truncate text-left">{shown}</span>
            <span className="text-right tabular-nums">{formatExact(Math.floor(row.totalPoints))}</span>
          </HudTableRow>
        );
      })}
      {!rows.length && (
        <p className="px-3 py-4 text-hud-label text-hud-muted">
          {finished ? "No points scored" : "No points scored yet"}
        </p>
      )}
    </>
  );
}
