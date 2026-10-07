import { useParams } from "react-router-dom";

import { formatAmount } from "@/ui/design-system/kit/amount";
import { formatDate } from "@/ui/design-system/kit/time";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { ordinal, sameAddress } from "./format";
import { modeLabel } from "./game-links";
import { type DirectoryGame, useLeaderboard, useRecentResults } from "./herald";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { Loading, Panel, PanelTitle } from "./kit";
import { ServiceFailure } from "./service-failure";
import { NothingHere } from "./not-found";
import { useProfiles } from "./profiles";
import { PageFrame } from "./frame/page-frame";

const HISTORY_LIMIT = 8;

const MatchRow = ({ game, address }: { game: DirectoryGame; address: string }) => {
  const leaderboard = useLeaderboard({ chainId: game.chainId, gameId: game.game_id });
  if (!leaderboard.isSuccess) return null;
  const board = leaderboard.data;
  const result =
    board.mode === "frontier"
      ? findResult(board.entries, address, (entry) => `${formatAmount(entry.sites_cleared.total)} sites`)
      : findResult(board.entries, address, (entry) => `${formatAmount(Math.round(entry.totalPoints))} VP`);
  if (!result) return null;
  return (
    <li className="flex items-center gap-3 border-t border-gold/10 py-2 text-[12.5px] first:border-t-0">
      <span className="w-[70px] flex-none font-mono text-[10.5px] font-semibold text-green">
        {ordinal(result.rank).toUpperCase()} / {board.entries.length}
      </span>
      <span>
        {game.name} · {modeLabel(game)} · {formatDate(game.clock.end_at)}
      </span>
      <span className="ml-auto font-mono text-[12px] tabular-nums text-gold">{result.score}</span>
    </li>
  );
};

/** A player's place in one game and what it was scored on: sites cleared in Frontier, victory points elsewhere. */
const findResult = <Entry extends { address: string; rank: number }>(
  entries: readonly Entry[],
  address: string,
  score: (entry: Entry) => string,
): { rank: number; score: string } | null => {
  const entry = entries.find((candidate) => sameAddress(candidate.address, address));
  return entry ? { rank: entry.rank, score: score(entry) } : null;
};

/** Public profile: name and portrait from identity, results from the shard's recorded standings. */
const PlayerBody = () => {
  const { address = "" } = useParams();
  const isAddress = /^0x[0-9a-fA-F]{1,64}$/.test(address);
  const profileOf = useProfiles(isAddress ? [address] : []);
  const history = useRecentResults(HISTORY_LIMIT, isAddress ? address : null);
  if (!isAddress) return <NothingHere />;
  const profile = profileOf(address);
  const games = history.data?.games ?? [];
  return (
    <div className="grid max-w-[880px] items-start gap-4 lg:grid-cols-[300px_1fr]">
      <Panel>
        <PanelTitle>Lord</PanelTitle>
        <div className="flex items-start gap-3.5">
          <img
            src={playerPortraitUrl(address, profile?.portrait)}
            alt=""
            className="h-16 w-16 rounded-lg border border-gold/40 object-cover"
          />
          <div className="font-ui text-[20px] font-bold tracking-wide text-gold">
            <PlayerName account={address} />
          </div>
        </div>
      </Panel>
      <Panel>
        <PanelTitle>Match history</PanelTitle>
        {history.isPending ? <Loading /> : null}
        {history.isError ? (
          <ServiceFailure service="results" error={history.error} retry={() => void history.refetch()} />
        ) : null}
        {history.isSuccess && games.length === 0 ? (
          <p className="text-sm text-gold/60">No finished games on record.</p>
        ) : null}
        <ul>
          {games.map((game) => (
            <MatchRow key={`${game.chainId}:${game.game_id}`} game={game} address={address} />
          ))}
        </ul>
      </Panel>
    </div>
  );
};

export const PlayerPage = () => (
  <PageFrame back="/season">
    <PlayerBody />
  </PageFrame>
);
