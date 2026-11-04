import { frontierCompetitionPhase, type HeraldFrontierLeaderboard } from "@bibliothecadao/eternum/game-sync";
import { formatExact, LORDS } from "@bibliothecadao/types";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import {
  COMPETITION_WORDS,
  competitionCloses,
  competitionClosed,
  farmingUntil,
  prizesAfter,
} from "@/ui/design-system/kit/words";
import { seasonPodium } from "./season-pool";

/** Final prize evidence stays reachable while the active game continues farming. Never implies a payment occurred. */
export function CompetitionResult({
  board,
  endAt,
  confirmedAt,
}: {
  board: HeraldFrontierLeaderboard;
  endAt: number;
  confirmedAt?: number;
}) {
  const phase = frontierCompetitionPhase(board, confirmedAt);
  const competition = board.competition;
  if (!competition) return null;
  return (
    <section
      aria-label={phase === "live" ? COMPETITION_WORDS.race : COMPETITION_WORDS.final}
      className="px-3 py-3 text-sm"
    >
      <p>{phase === "live" ? competitionCloses(competition.cutoff) : competitionClosed(competition.cutoff)}</p>
      <p>{farmingUntil(endAt)}</p>
      {phase === "confirming" && <p role="status">{COMPETITION_WORDS.confirming}</p>}
      {phase === "final" && (
        <>
          <h2 className="mt-2 font-semibold">{COMPETITION_WORDS.final}</h2>
          <ol>
            {seasonPodium(board)?.map(({ place, lords, holder }) => (
              <li key={place} className="flex items-center gap-2">
                <span>#{place}</span>
                {typeof holder !== "string" && <PlayerName account={holder.address} />}
                <span>
                  {formatExact(lords)} {LORDS}
                </span>
              </li>
            ))}
          </ol>
          <p>{prizesAfter(endAt)}</p>
        </>
      )}
    </section>
  );
}
