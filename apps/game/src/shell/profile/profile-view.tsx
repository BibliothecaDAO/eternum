import { PROFILE_WORDS, SEASON_WORDS } from "@/ui/design-system/kit/words";
import { formatAmount } from "@bibliothecadao/types";
import { useIdentitySession } from "@/hooks/context/identity-session";
import { usePlayerProfile } from "@/hooks/use-player-profile";
import { profileOfIdentityUser } from "@realms-world/identity";

import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { findOwnEntry } from "@/ui/features/frontier/board/standings";

import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { AppPanel, AppPortrait } from "@/ui/design-system/kit/app-elements";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";

import { useLayout } from "../frame/layout";
import { gameRefOf, useDirectory, useLeaderboard, useRecentResults } from "../herald";
import { Loading } from "../loading";
import { OwnRatingLine } from "../rating-line";
import { ageOf } from "../play/ages";
import { chooseSeason } from "../season";
import { HistoryRow } from "../season-tab/history-row";
import { HoldingsStrip } from "./holdings-strip";
import { useNowSeconds } from "../use-now";

/**
 * The profile a player's card shows: the player's own from the signed-in session, known at once, so the card never
 * opens on a stand-in name and face (qa-app-1 P3-4); another player's as identity answers it.
 */
const useCardProfile = (account: string, own: boolean) => {
  const { session } = useIdentitySession();
  const fromSession = own && session !== null;
  const looked = usePlayerProfile(fromSession ? null : account);
  return fromSession ? { ...profileOfIdentityUser(session.user), known: true } : looked;
};

/** How many finished games a player's page lists. */
const HISTORY = 8;

/** The live Frontier season's board row for a player: their Order and their rank, the page's one figure. */
const useSeasonStanding = (account: string) => {
  const season = chooseSeason(useDirectory().data?.games ?? [], true);
  const board = useLeaderboard(season ? gameRefOf(season) : null);
  const entries = board.data?.mode === "frontier" ? board.data.entries : undefined;
  return { own: entries && findOwnEntry(entries, account), field: entries?.length };
};

/**
 * Who a player is (spec 10): their card (their season's painting with their place on its board, the portrait and the
 * name, the player's own rating) and their finished games. The player's own card wears the accent ring. On the desktop
 * the games stand at the card's right.
 */
export const ProfileView = ({ account, own }: { account: string; own: boolean }) =>
  useLayout() === "phone" ? (
    <div className="flex flex-col gap-4">
      <PlayerCard account={account} own={own} />
      <History account={account} own={own} />
    </div>
  ) : (
    <div className="grid grid-cols-[theme(width.rail)_minmax(0,1fr)] items-start gap-6">
      <PlayerCard account={account} own={own} />
      <RecentGames account={account} own={own} />
    </div>
  );

/**
 * A player's card: Frontier's painting in its head with the player's place on the season's board, then the portrait,
 * the name and, on the player's own card, their Blitz rating and at its foot what they hold (another player's wallet is
 * not known here).
 */
export const PlayerCard = ({ account, own }: { account: string; own: boolean }) => {
  const profile = useCardProfile(account, own);
  const { own: standing, field } = useSeasonStanding(account);
  const frontier = ageOf("frontier");
  return (
    <AppPanel
      title={frontier.name}
      painting={frontier.painting}
      cue={
        standing ? (
          <span className="flex items-center gap-1.5">
            <OrderEmblem order={standing.order} size={20} />
            <b className="text-app-gold">{`#${standing.rank}`}</b>
            {SEASON_WORDS.of} {formatAmount(field)}
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <AppPortrait
          src={profile.known ? playerPortraitUrl(account, profile.portrait) : undefined}
          name={profile.known ? (profile.name ?? "") : ""}
          size="lg"
          own={own}
        />
        <h2 className="max-w-full text-app-title text-app-ink">
          <PlayerName account={account} profile={profile.known ? profile : undefined} />
        </h2>
        {!standing && <p className="text-app-label text-app-muted">{SEASON_WORDS.notOnBoard}</p>}
        {own && <OwnRatingLine />}
      </div>
      {own && <HoldingsStrip />}
    </AppPanel>
  );
};

/**
 * The desktop's finished games, in their panel; none yet, the panel says where they will show, so the page's right half
 * is never empty (qa-app-1 P3-9).
 */
export const RecentGames = ({ account, own }: { account: string; own: boolean }) => (
  <History account={account} own={own} titled />
);

/** Their finished games, newest first, in their panel. None yet: the desktop's panel says so, and the phone shows nothing. */
const History = ({ account, own, titled = false }: { account: string; own: boolean; titled?: boolean }) => {
  const history = useRecentResults(HISTORY, account);
  const now = useNowSeconds();
  if (history.isError)
    return <ServiceFailure service="results" error={history.error} retry={() => void history.refetch()} />;
  if (history.isPending) return <Loading />;
  if (history.data.games.length === 0)
    return titled ? (
      <AppPanel title={PROFILE_WORDS.recentGames} icon="victory">
        <p className="text-app-body text-app-muted">{own ? PROFILE_WORDS.noGamesOwn : PROFILE_WORDS.noGames}</p>
      </AppPanel>
    ) : null;
  return (
    <AppPanel title={PROFILE_WORDS.recentGames} icon="victory" flush>
      {history.data.games.map((game) => (
        <HistoryRow key={`${game.chainId}:${game.game_id}`} game={game} player={account} now={now} />
      ))}
    </AppPanel>
  );
};
