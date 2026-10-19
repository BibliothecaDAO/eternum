import { formatExact } from "@bibliothecadao/types";
import { payoutAddressOf } from "@/hooks/context/payout-wallet";
import { useIdentitySession } from "@/hooks/context/identity-session";
import { shortAddress } from "@/ui/design-system/kit/address";
import { AppChip, AppEmpty, AppFigure, AppPanel, AppRank, AppRow } from "@/ui/design-system/kit/app-elements";
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

/** How many of the rating's top rows Season shows before the reader's own row. */
const TOP_ROWS = 10;

type RatingTop = NonNullable<ReturnType<typeof useRatingTop>["data"]>;
type Self = RatingTop["self"];

/**
 * Blitz's board on Season, under Blitz's painting: the season's pool at its title, the reader's rating with its tier's
 * mark, then the rating's top rows with the reader's own under them when it ranks below. The season prize is paid by rating place, so while it
 * runs each paid row carries what it would take if the season ended now; once over, the reader's share and its claim
 * stand above the rows. The prize and the rating are two reads, each waiting and failing on its own: a share to claim
 * stays claimable while the rating is down.
 */
export const BlitzBoard = () => {
  const { session } = useIdentitySession();
  const top = useRatingTop(TOP_ROWS, session ? payoutAddressOf(session.user) : null);
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
        <Ratings top={top} shares={prize.shares} />
      </AppPanel>
    </div>
  );
};

/** The rating's rows, or its own wait or failure. */
const Ratings = ({ top, shares }: { top: ReturnType<typeof useRatingTop>; shares: bigint[] | null }) => {
  if (top.isError) return <ServiceFailure service="ratings" error={top.error} retry={() => void top.refetch()} />;
  if (top.isPending) return <Loading />;
  return <TopRows top={top.data} shares={shares} />;
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
 * The top rows, the reader's own lit in place, or pinned under them (its rank a dash before its first rated game); a
 * paid place carries its share of the pool today.
 */
const TopRows = ({ top, shares }: { top: RatingTop; shares: bigint[] | null }) => {
  const self = top.self;
  if (top.entries.length === 0 && self === null) return <AppEmpty icon="leaderboard" line={RATING_WORDS.noneRated} />;
  const ownInTop = self !== null && top.entries.some((entry) => isSameStarknetAddress(entry.player, self.player));
  const shareOf = (rank: number | null) => (shares && rank !== null ? shares[rank - 1] : undefined);
  return (
    <ol className="flex flex-col">
      {top.entries.map((entry) => (
        <RatingRow
          key={entry.player}
          {...entry}
          share={shareOf(entry.rank)}
          own={self !== null && isSameStarknetAddress(entry.player, self.player)}
        />
      ))}
      {self && !ownInTop && <RatingRow {...self} share={shareOf(self.rank)} own />}
    </ol>
  );
};

const RatingRow = ({
  rank,
  player,
  rating,
  profile,
  share,
  own,
}: {
  rank: number | null;
  player: string;
  rating: string;
  profile: RatingProfile;
  share: bigint | undefined;
  own: boolean;
}) => (
  <li>
    <AppRow
      own={own}
      lead={rank === null ? <span className="app-rank">—</span> : <AppRank rank={rank} />}
      title={<RatedOwner player={player} profile={profile} own={own} />}
      trail={
        <>
          <AppChip icon={tierOf(ratingPoints(rating)).mark}>
            <span aria-label={tierOf(ratingPoints(rating)).name}>{formatExact(ratingPoints(rating))}</span>
          </AppChip>
          {share !== undefined && (
            <AppChip icon="lords" tone="gold">
              {formatExact(lordsOf(share))}
            </AppChip>
          )}
        </>
      }
    />
  </li>
);

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
