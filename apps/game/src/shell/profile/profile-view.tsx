import { usePlayerProfile } from "@/hooks/use-player-profile";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatAmount } from "@/ui/design-system/kit/amount";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { findOwnEntry } from "@/ui/features/frontier/board/standings";

import { useLayout } from "../frame/layout";
import { useDirectory, useLeaderboard, useRecentResults } from "../herald";
import { Loading } from "../loading";
import { RatingLine } from "../rating-line";
import { paintingSources } from "../paintings";
import { Panel } from "../panel";
import { AgeLabel } from "../play/age-card";
import { ageOf } from "../play/ages";
import { chooseSeason } from "../season";
import { HistoryRow } from "../season-tab/history-row";
import { ServiceFailure } from "../service-failure";
import { useNowSeconds } from "../use-now";
import { PROFILE_WORDS, SEASON_WORDS } from "../words";

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
    <div className="grid grid-cols-[26rem_minmax(0,1fr)] items-start gap-6">
      <PlayerCard account={account} own={own} />
      <RecentGames account={account} />
    </div>
  );

/**
 * The desktop's card for a player: Frontier's painting above, the portrait on its edge, the name, the season's place
 * with the Order, and the player's Blitz rating, read by their gameplay account.
 */
export const PlayerCard = ({ account, own }: { account: string; own: boolean }) => {
  const profile = usePlayerProfile(account);
  const { own: standing, field } = useSeasonStanding(account);
  const frontier = ageOf("frontier");
  return (
    <section className="plate flex flex-col items-center gap-2 overflow-hidden pb-5">
      <span className="painted -mb-12 block h-28 w-full rounded-none border-0">
        <img
          {...paintingSources(frontier.painting)}
          sizes="26rem"
          alt=""
          className="absolute inset-0 -z-10 size-full object-cover"
        />
      </span>
      <img
        src={playerPortraitUrl(account, profile.portrait)}
        alt=""
        className={cn(
          "relative size-24 rounded-full border-[3px] object-cover",
          own ? "border-kit-peach" : "border-kit-line2",
        )}
      />
      <h2 className="max-w-full px-4 font-display text-[30px] leading-none text-kit-cream">
        <PlayerName account={account} />
      </h2>
      <p className="flex items-center gap-2 text-[14px] text-kit-muted">
        {standing && <OrderEmblem order={standing.order} size={20} />}
        <b className="font-ui text-kit-gold">{standing ? `#${standing.rank}` : "—"}</b>
        {SEASON_WORDS.of} {formatAmount(field)} ·
        <AgeLabel numeral={frontier.numeral} />
        <span className="text-kit-cream">{frontier.name}</span>
      </p>
      <RatingLine account={account} own={own} />
    </section>
  );
};

/** The desktop's finished games, in a titled plate. */
export const RecentGames = ({ account }: { account: string }) => (
  <Panel icon="Tp" title={PROFILE_WORDS.recentGames}>
    <History account={account} framed={false} />
  </Panel>
);

/** The player's banner: until their best age is a recorded fact, Frontier's painting stands for it. */
const ProfileBanner = ({ account, own }: { account: string; own: boolean }) => {
  const profile = usePlayerProfile(account);
  const { own: standing } = useSeasonStanding(account);
  return (
    <section className="painted flex h-40 items-end gap-3 rounded-2xl p-3">
      <img
        {...paintingSources(ageOf("frontier").painting)}
        sizes="(min-width: 1024px) 50vw, 100vw"
        alt=""
        className="absolute inset-0 -z-10 size-full object-cover"
      />
      <span className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-kit-ground/90" />
      <img
        src={playerPortraitUrl(account, profile.portrait)}
        alt=""
        className={cn("size-20 rounded-full border-[3px] object-cover", own ? "border-kit-peach" : "border-kit-line2")}
      />
      <div className="flex min-w-0 items-center gap-2 pb-2 font-ui text-[22px] font-bold text-kit-cream">
        {standing && <OrderEmblem order={standing.order} size={26} />}
        <PlayerName account={account} />
      </div>
    </section>
  );
};

/** The one figure: the season rank of the field, with the age it was earned in. */
const SeasonFigure = ({ account }: { account: string }) => {
  const { own, field } = useSeasonStanding(account);
  const frontier = ageOf("frontier");
  return (
    <section className="flex items-center gap-3 plate p-3">
      <KitIcon code="Tp" size={30} />
      <span className="font-ui text-[28px] font-extrabold tabular-nums text-kit-gold">
        {own ? `#${own.rank}` : "—"}
      </span>
      <span className="text-[15px] text-kit-muted">
        {SEASON_WORDS.of} {formatAmount(field)}
      </span>
      <span className="ml-auto flex items-center gap-2">
        <AgeLabel numeral={frontier.numeral} />
        <span className="font-ui text-[15px] font-bold text-kit-cream">{frontier.name}</span>
      </span>
    </section>
  );
};

/** Their finished games, newest first; absent when they have none. */
const History = ({ account, framed = true }: { account: string; framed?: boolean }) => {
  const history = useRecentResults(HISTORY, account);
  const now = useNowSeconds();
  if (history.isError)
    return <ServiceFailure service="results" error={history.error} retry={() => void history.refetch()} />;
  if (history.isPending) return <Loading />;
  if (history.data.games.length === 0) return null;
  return (
    <ul className={cn(framed && "plate px-2")}>
      {history.data.games.map((game) => (
        <HistoryRow key={`${game.chainId}:${game.game_id}`} game={game} player={account} now={now} />
      ))}
    </ul>
  );
};
