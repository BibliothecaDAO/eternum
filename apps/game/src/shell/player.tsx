import { useParams } from "react-router-dom";

import { formatDate, ordinal, sameAddress, shortAddress } from "./format";
import { modeLabel } from "./game-links";
import { type DirectoryGame, useLeaderboard, useRecentResults } from "./herald";
import { portraitUrl } from "./identity-chip";
import { ErrorPanel, Loading, Panel, PanelTitle } from "./kit";
import { NotFoundPage } from "./not-found";
import { useProfiles } from "./profiles";

const HISTORY_LIMIT = 8;

const MatchRow = ({ game, address }: { game: DirectoryGame; address: string }) => {
  const leaderboard = useLeaderboard({ chainId: game.chainId, gameId: game.game_id });
  const entry = leaderboard.data?.entries.find((candidate) => sameAddress(candidate.address, address));
  if (!leaderboard.isSuccess || !entry) return null;
  return (
    <li className="flex items-center gap-3 border-t border-gold/10 py-2 text-[12.5px] first:border-t-0">
      <span className="w-[70px] flex-none font-mono text-[10.5px] font-semibold text-green">
        {ordinal(entry.rank).toUpperCase()} / {leaderboard.data.entries.length}
      </span>
      <span>
        {game.name} · {modeLabel(game)} · {formatDate(game.clock.end_at)}
      </span>
      <span className="ml-auto font-mono text-[12px] tabular-nums text-gold">
        {Math.round(entry.totalPoints).toLocaleString()} VP
      </span>
    </li>
  );
};

/** Public profile: name and portrait from identity, results from the shard's recorded standings. */
export const PlayerPage = () => {
  const { address = "" } = useParams();
  const isAddress = /^0x[0-9a-fA-F]{1,64}$/.test(address);
  const profileOf = useProfiles(isAddress ? [address] : []);
  const history = useRecentResults(HISTORY_LIMIT, isAddress ? address : null);
  if (!isAddress) return <NotFoundPage title="No such lord">That is not a gameplay account address.</NotFoundPage>;
  const profile = profileOf(address);
  const games = history.data?.games ?? [];
  return (
    <div className="grid max-w-[880px] items-start gap-4 lg:grid-cols-[300px_1fr]">
      <Panel>
        <PanelTitle>Lord</PanelTitle>
        <div className="flex items-start gap-3.5">
          <img
            src={portraitUrl(profile?.portrait ?? null)}
            alt=""
            className="h-16 w-16 rounded-lg border border-gold/40 object-cover"
          />
          <div className="font-cinzel text-[20px] font-bold tracking-wide text-gold">
            {profile?.name ?? shortAddress(address)}
          </div>
        </div>
      </Panel>
      <Panel>
        <PanelTitle>Match history</PanelTitle>
        {history.isPending ? <Loading /> : null}
        {history.isError ? (
          <ErrorPanel
            message="This player's games are unavailable right now."
            error={history.error}
            retry={() => void history.refetch()}
          />
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
