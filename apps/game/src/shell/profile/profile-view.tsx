import { PROFILE_WORDS, SEASON_WORDS } from "@/ui/design-system/kit/words";
import { formatAmount } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { usePlayerProfile } from "@/hooks/use-player-profile";

import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { findOwnEntry } from "@/ui/features/frontier/board/standings";

import { useLayout } from "../frame/layout";
import { useDirectory, useLeaderboard, useRecentResults } from "../herald";
import { Loading } from "../loading";
import { OwnRatingLine } from "../rating-line";
import { Panel } from "@/ui/design-system/kit/panel";
import { Title } from "@/ui/design-system/kit/title";
import { Figure } from "@/ui/design-system/kit/figure";
import { Portrait } from "@/ui/design-system/kit/portrait";
import { ageOf } from "../play/ages";
import { chooseSeason } from "../season";
import { HistoryRow } from "../season-tab/history-row";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { PaintedCard } from "@/ui/design-system/kit/painted-card";
import { useNowSeconds } from "../use-now";

/** How many finished games a player's page lists. */
const HISTORY = 8;

/** The live Frontier season's board row for a player: their Order and their rank, the page's one figure. */
const useSeasonStanding = (account: string) => {
  const season = chooseSeason(useDirectory().data?.games ?? [], true);
  const board = useLeaderboard(season ? { chainId: season.chainId, gameId: season.game_id } : null);
  const entries = board.data?.mode === "frontier" ? board.data.entries : undefined;
  return { own: entries && findOwnEntry(entries, account), field: entries?.length };
};

/**
 * Who a player is (spec 10): the banner (their best age's painting), the portrait, their Order and name; the one
 * figure, their season rank; and their finished games. The player's own page wears the peach ring.
 */
export const ProfileView = ({ account, own }: { account: string; own: boolean }) =>
  useLayout() === "phone" ? (
    <div className="flex flex-col gap-4">
      <ProfileBanner account={account} own={own} />
      <SeasonFigure account={account} />
      <History account={account} />
    </div>
  ) : (
    <div className="grid grid-cols-[theme(width.rail)_minmax(0,1fr)] items-start gap-6">
      <PlayerCard account={account} own={own} />
      <RecentGames account={account} />
    </div>
  );

/**
 * The desktop's card for a player: Frontier's painting above, the portrait on its edge, the name, the season's place
 * with the Order, and on the player's own card their Blitz rating (another player's wallet is not known here).
 */
export const PlayerCard = ({ account, own }: { account: string; own: boolean }) => {
  const profile = usePlayerProfile(account);
  const { own: standing, field } = useSeasonStanding(account);
  const frontier = ageOf("frontier");
  return (
    <section className="plate flex flex-col items-center gap-2 overflow-hidden pb-5">
      <PaintedCard
        as="span"
        painting={frontier.painting}
        sizes="26rem"
        grade="none"
        className="-mb-12 block h-28 w-full rounded-none border-0"
      />
      <Portrait
        account={account}
        portrait={profile.portrait}
        size={96}
        weight={3}
        ring={own ? "lit" : "line"}
        className="relative"
      />
      <Title level="plate" as="h2" className="max-w-full px-4 leading-none">
        <PlayerName account={account} />
      </Title>
      {standing ? (
        <p className="flex items-center gap-2 text-sm text-kit-muted">
          <OrderEmblem order={standing.order} size={20} />
          <b className="font-body text-kit-gold">{`#${standing.rank}`}</b>
          {SEASON_WORDS.of} {formatAmount(field)} ·<span className="text-kit-cream">{frontier.name}</span>
        </p>
      ) : (
        <p className="text-sm text-kit-muted">{SEASON_WORDS.notOnBoard}</p>
      )}
      {own && <OwnRatingLine />}
    </section>
  );
};

/** The desktop's finished games, in a titled plate; none, no plate. */
export const RecentGames = ({ account }: { account: string }) => <History account={account} titled />;

/**
 * The player's banner, their portrait and name at its top: until their best age is a recorded fact, Frontier's painting
 * stands for it, behind them.
 */
const ProfileBanner = ({ account, own }: { account: string; own: boolean }) => {
  const profile = usePlayerProfile(account);
  const { own: standing } = useSeasonStanding(account);
  return (
    <PaintedCard
      painting={ageOf("frontier").painting}
      sizes="(min-width: 1024px) 50vw, 100vw"
      grade="top-deep"
      className="flex h-40 items-start gap-3 p-3"
    >
      <Portrait account={account} portrait={profile.portrait} size={80} weight={3} ring={own ? "lit" : "line"} />
      <div className="flex min-h-20 min-w-0 items-center gap-2 font-body text-xl font-bold text-kit-cream">
        {standing && <OrderEmblem order={standing.order} size={26} />}
        <PlayerName account={account} />
      </div>
    </PaintedCard>
  );
};

/** The one figure: the season rank of the field on Frontier's board, or that the player is not on it yet. */
const SeasonFigure = ({ account }: { account: string }) => {
  const { own, field } = useSeasonStanding(account);
  return (
    <section className="flex items-center gap-3 plate p-3">
      <SemanticIcon name="victory" size={30} />
      {own ? (
        <>
          <Figure as="span" size="heading" tone="gold">
            {`#${own.rank}`}
          </Figure>
          <span className="text-base text-kit-muted">
            {SEASON_WORDS.of} {formatAmount(field)}
          </span>
          <span className="ml-auto font-body text-base font-bold text-kit-cream">{ageOf("frontier").name}</span>
        </>
      ) : (
        <span className="text-base text-kit-muted">{SEASON_WORDS.notOnBoard}</span>
      )}
    </section>
  );
};

/** Their finished games, newest first, on a plate (titled on desktop); absent when they have none. */
const History = ({ account, titled = false }: { account: string; titled?: boolean }) => {
  const history = useRecentResults(HISTORY, account);
  const now = useNowSeconds();
  if (history.isError)
    return <ServiceFailure service="results" error={history.error} retry={() => void history.refetch()} />;
  if (history.isPending) return <Loading />;
  if (history.data.games.length === 0) return null;
  const rows = history.data.games.map((game) => (
    <HistoryRow key={`${game.chainId}:${game.game_id}`} game={game} player={account} now={now} />
  ));
  return titled ? (
    <Panel icon="victory" title={PROFILE_WORDS.recentGames}>
      <ul>{rows}</ul>
    </Panel>
  ) : (
    <ul className="plate px-2">{rows}</ul>
  );
};
