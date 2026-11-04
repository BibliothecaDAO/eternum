import { formatExact } from "@bibliothecadao/types";
import { payoutAddressOf } from "@/hooks/context/payout-wallet";
import { useIdentitySession } from "@/hooks/context/identity-session";
import { shortAddress } from "@/ui/design-system/kit/address";
import {
  AppBoard,
  type AppBoardEntry,
  AppEmpty,
  AppFigure,
  AppPanel,
  AppRank,
} from "@/ui/design-system/kit/app-elements";
import { RATING_WORDS } from "@/ui/design-system/kit/words";

import { PlayerName } from "@/ui/design-system/kit/player-name";

import { isSameStarknetAddress } from "@realms-world/identity";
import { Loading } from "../loading";
import { Portrait } from "@/ui/design-system/kit/portrait";
import { ageOf } from "../play/ages";
import { type RatingProfile, ratingPoints, tierOf, useRatingTop } from "../ratings";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { useNowSeconds } from "../use-now";
import { lordsOf } from "../value/ledger";
import { PrizeHead, PrizeLines, useBoardPrize } from "./season-prize";

type RatingTop = NonNullable<ReturnType<typeof useRatingTop>["data"]>;
type Self = RatingTop["self"];

/**
 * Blitz's board on Season, under Blitz's painting: the season's pool at its title, the reader's rating with its tier's
 * mark, then every rated wallet's row in a scroll area `rows` rows tall, the reader's own lit (AppBoard's one rule).
 * The season prize is paid by rating place, so while it runs each paid row carries what it would take if the season
 * ended now; once over, the reader's share and its claim stand above the rows. The prize and the rating are two reads,
 * each waiting and failing on its own: a share to claim stays claimable while the rating is down.
 */
export const BlitzBoard = ({ rows }: { rows: number }) => {
  const { session } = useIdentitySession();
  const top = useRatingTop(session ? payoutAddressOf(session.user) : null);
  const now = useNowSeconds();
  const prize = useBoardPrize(now);
  const blitz = ageOf("blitz");
  return (
    <div data-age="blitz">
      <AppPanel
        icon="leaderboard"
        title={blitz.name}
        painting={blitz.painting}
        cue={prize.prize && <PrizeHead prize={prize.prize} state={prize.state} />}
        flush
      >
        <div className="flex flex-col px-4 empty:hidden">
          {top.isSuccess && <OwnRating self={top.data.self} signedIn={session !== null} />}
          <PrizeLines prize={prize} now={now} onClaimed={() => void prize.query.refetch()} />
        </div>
        <Ratings top={top} shares={prize.shares} rows={rows} />
      </AppPanel>
    </div>
  );
};

/** The rating's rows, or its own wait or failure. */
const Ratings = ({
  top,
  shares,
  rows,
}: {
  top: ReturnType<typeof useRatingTop>;
  shares: bigint[] | null;
  rows: number;
}) => {
  if (top.isError) return <ServiceFailure service="ratings" error={top.error} retry={() => void top.refetch()} />;
  if (top.isPending) return <Loading />;
  return <RatedRows top={top.data} shares={shares} rows={rows} />;
};

/** The reader's rating with its tier's mark; a reader with no wallet is told how to carry one. Signed out, nothing. */
const OwnRating = ({ self, signedIn }: { self: Self; signedIn: boolean }) => {
  if (self === null)
    return signedIn ? <p className="py-3 text-app-body text-app-muted">{RATING_WORDS.unlinked}</p> : null;
  const tier = tierOf(ratingPoints(self.rating));
  return (
    <div className="py-3">
      <AppFigure
        icon={tier.mark}
        value={formatExact(ratingPoints(self.rating))}
        label={`${tier.name} · ${RATING_WORDS.blitzRating}`}
      />
    </div>
  );
};

/**
 * Every rated wallet's row, the reader's own lit in place, or last before its first rated game (its rank a dash); a
 * paid place carries its share of the pool today.
 */
const RatedRows = ({ top, shares, rows }: { top: RatingTop; shares: bigint[] | null; rows: number }) => {
  const self = top.self;
  if (top.entries.length === 0 && self === null) return <AppEmpty icon="leaderboard" line={RATING_WORDS.noneRated} />;
  const ranked = self !== null && top.entries.some((entry) => isSameStarknetAddress(entry.player, self.player));
  const shareOf = (rank: number | null) => (shares && rank !== null ? shares[rank - 1] : undefined);
  const own = (entry: RatedRow) => self !== null && isSameStarknetAddress(entry.player, self.player);
  const rated: RatedRow[] = self && !ranked ? [...top.entries, self] : top.entries;
  return <AppBoard rows={rows} entries={rated.map((row) => ratedEntry(row, shareOf(row.rank), own(row)))} />;
};

type RatedRow = { rank: number | null; player: string; rating: string; profile: RatingProfile };

/**
 * A rated wallet's row: its rank (a dash before its first rated game), its owner, its rating by its tier's mark, and a
 * paid place's share.
 */
const ratedEntry = (row: RatedRow, share: bigint | undefined, own: boolean): AppBoardEntry => {
  const tier = tierOf(ratingPoints(row.rating));
  return {
    key: row.player,
    own,
    lead: row.rank === null ? <span className="app-rank">—</span> : <AppRank rank={row.rank} />,
    name: <RatedOwner player={row.player} profile={row.profile} own={own} />,
    figures: [
      { icon: tier.mark, value: formatExact(ratingPoints(row.rating)), label: tier.name },
      share === undefined ? undefined : { icon: "lords", value: formatExact(lordsOf(share)), tone: "gold" },
    ],
  };
};

/**
 * A rated wallet's owner by the service's profile: their name by the kit's one rule (never looked up by the wallet);
 * an owner with no Realms identity, or one that chose no name, as the wallet's address. The reader's own row is You.
 */
const RatedOwner = ({ player, profile, own }: { player: string; profile: RatingProfile; own: boolean }) =>
  own || profile?.name ? (
    <PlayerName account={player} you={own} portrait profile={profile ?? undefined} />
  ) : (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Portrait account={player} portrait={profile?.portrait} size={28} weight={1.5} className="shrink-0" />
      <span className="truncate text-app-muted">{shortAddress(player)}</span>
    </span>
  );
