import { payoutAddressOf } from "@/hooks/context/payout-wallet";
import { useIdentitySession } from "@/hooks/context/identity-session";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatExact } from "@/ui/design-system/kit/amount";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { shortAddress } from "@/ui/design-system/kit/address";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { PlayerName } from "@/ui/design-system/kit/player-name";

import { isSameStarknetAddress } from "@realms-world/identity";
import { Loading } from "../loading";
import { Panel } from "../panel";
import { ageOf } from "../play/ages";
import { RatingFigure, TierMark } from "../rating-mark";
import { type RatingProfile, ratingPoints, tierOf, useRatingTop } from "../ratings";
import { ServiceFailure } from "../service-failure";
import { useNowSeconds } from "../use-now";
import { lordsOf } from "../value/ledger";
import { RATING_WORDS } from "../words";
import { PrizeHead, PrizeLines, useBoardPrize } from "./season-prize";

/** How many of the rating's top rows Season shows before the reader's own row. */
const TOP_ROWS = 10;

type RatingTop = NonNullable<ReturnType<typeof useRatingTop>["data"]>;
type Self = RatingTop["self"];

/**
 * Blitz's board on Season (spec 09): the season's pool at its title, the reader's tier and rating, then the rating's
 * top rows with the reader's own under them when it ranks below. The season prize is paid by rating place, so while it
 * runs each paid row carries what it would take if the season ended now; once over, the reader's share and its claim
 * stand above the rows. The prize and the rating are two reads, each waiting and failing on its own: a share to claim
 * stays claimable while the rating is down.
 */
export const BlitzBoard = () => {
  const { session } = useIdentitySession();
  const top = useRatingTop(TOP_ROWS, session ? payoutAddressOf(session.user) : null);
  const now = useNowSeconds();
  const prize = useBoardPrize(now);
  return (
    <Panel
      icon="Pl"
      title={ageOf("blitz").name}
      aside={prize.prize && <PrizeHead prize={prize.prize} state={prize.state} />}
    >
      {top.isSuccess && <OwnRating self={top.data.self} signedIn={session !== null} />}
      <PrizeLines prize={prize} now={now} onClaimed={() => void prize.query.refetch()} />
      <Ratings top={top} shares={prize.shares} />
    </Panel>
  );
};

/** The rating's rows, or its own wait or failure. */
const Ratings = ({ top, shares }: { top: ReturnType<typeof useRatingTop>; shares: bigint[] | null }) => {
  if (top.isError) return <ServiceFailure service="ratings" error={top.error} retry={() => void top.refetch()} />;
  if (top.isPending) return <Loading />;
  return <TopRows top={top.data} shares={shares} />;
};

/** The reader's tier and rating, large; a reader with no wallet is told how to carry one. Signed out, nothing. */
const OwnRating = ({ self, signedIn }: { self: Self; signedIn: boolean }) => {
  if (self === null)
    return signedIn ? <p className="px-1 py-2 text-base text-kit-muted">{RATING_WORDS.unlinked}</p> : null;
  return (
    <div className="flex items-center gap-3 px-1 py-2">
      <TierMark rating={self.rating} size={40} />
      <span className="flex flex-col">
        <b className="font-body text-base text-kit-cream">{tierOf(ratingPoints(self.rating)).name}</b>
        <span className="text-sm text-kit-muted">{RATING_WORDS.blitzRating}</span>
      </span>
      <span className="ml-auto font-body text-[34px] font-bold tabular-nums text-kit-cream">
        {formatExact(ratingPoints(self.rating))}
      </span>
    </div>
  );
};

/**
 * The top rows, the reader's own lit in place, or pinned under them (its rank a dash before its first rated game); a
 * paid place carries its share of the pool today.
 */
const TopRows = ({ top, shares }: { top: RatingTop; shares: bigint[] | null }) => {
  const self = top.self;
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
  <li
    className={cn(
      "flex min-h-12 items-center gap-3 border-b border-kit-line px-1 last:border-b-0",
      own && "rounded-xl border border-kit-gold bg-kit-ground",
    )}
  >
    <span className="w-8 text-right font-body text-base font-bold tabular-nums text-kit-cream">
      {rank === null ? "—" : rank}
    </span>
    <span className="min-w-0 flex-1">
      <RatedOwner player={player} profile={profile} own={own} />
    </span>
    <RatingFigure rating={rating} />
    {share !== undefined && (
      <span className="inline-flex w-24 items-center justify-end gap-1 font-body text-base font-bold tabular-nums text-kit-gold2">
        <KitIcon code="Lo" size={16} />
        {formatExact(lordsOf(share))}
      </span>
    )}
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
      <img
        src={playerPortraitUrl(player, profile?.portrait ?? null)}
        alt=""
        className="size-7 shrink-0 rounded-full border-[1.5px] border-kit-line2 object-cover"
      />
      <span className="truncate text-kit-muted">{shortAddress(player)}</span>
    </span>
  );
