import type { ReactNode } from "react";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatExact } from "@/ui/design-system/kit/amount";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { shortAddress } from "@/ui/design-system/kit/address";
import { PlayerName } from "@/ui/design-system/kit/player-name";

import { sameAddress } from "../format";
import { Loading } from "../loading";
import { Panel } from "../panel";
import { ageOf } from "../play/ages";
import { RatingFigure, TierMark } from "../rating-mark";
import { type RatingProfile, ratingPoints, tierOf, useRatingTop } from "../ratings";
import { ServiceFailure } from "../service-failure";
import { RATING_WORDS } from "../words";

/** How many of the rating's top rows Season shows before the reader's own row. */
const TOP_ROWS = 6;

type RatingTop = NonNullable<ReturnType<typeof useRatingTop>["data"]>;
type Self = RatingTop["self"];

/**
 * Blitz on the desktop's Season (spec 09, desktop design): the reader's tier and rating, the rating's top rows with the
 * reader's own row under them when it ranks below, then the reader's finished Blitz games.
 */
export const BlitzPanel = ({ games }: { games: ReactNode }) => {
  const { session } = useIdentitySession();
  const top = useRatingTop(TOP_ROWS, session?.user.realmsId ?? null);
  return (
    <Panel icon="Pl" title={ageOf("blitz").name}>
      {top.isError ? (
        <ServiceFailure service="ratings" error={top.error} retry={() => void top.refetch()} />
      ) : top.isPending ? (
        <Loading />
      ) : (
        <>
          <OwnRating self={top.data.self} />
          <SubHead word={RATING_WORDS.rating} />
          <TopRows top={top.data} />
        </>
      )}
      {games && (
        <>
          <SubHead word={RATING_WORDS.yourGames} />
          {games}
        </>
      )}
    </Panel>
  );
};

const SubHead = ({ word }: { word: string }) => (
  <h3 className="mt-3 px-1 font-ui text-[13px] tracking-[.06em] text-kit-muted">{word}</h3>
);

/** The reader's tier and rating, large; a reader with no linked wallet is told how to carry one. Signed out, nothing. */
const OwnRating = ({ self }: { self: Self }) => {
  if (self === null) return null;
  if (self.status !== "rated") return <p className="px-1 py-2 text-[15px] text-kit-muted">{RATING_WORDS.unlinked}</p>;
  return (
    <div className="flex items-center gap-3 px-1 py-2">
      <TierMark rating={self.rating} size={40} />
      <span className="flex flex-col">
        <b className="font-ui text-[17px] text-kit-cream">{tierOf(ratingPoints(self.rating)).name}</b>
        <span className="text-[13px] text-kit-muted">{RATING_WORDS.blitzRating}</span>
      </span>
      <span className="ml-auto font-ui text-[34px] font-bold tabular-nums text-kit-cream">
        {formatExact(ratingPoints(self.rating))}
      </span>
    </div>
  );
};

/** The top rows, the reader's own lit in place, or pinned under them (its rank a dash before its first rated game). */
const TopRows = ({ top }: { top: RatingTop }) => {
  const self = top.self?.status === "rated" ? top.self : null;
  const ownInTop = self !== null && top.entries.some((entry) => sameAddress(entry.player, self.player));
  return (
    <ol className="flex flex-col">
      {top.entries.map((entry) => (
        <RatingRow key={entry.player} {...entry} own={self !== null && sameAddress(entry.player, self.player)} />
      ))}
      {self && !ownInTop && <RatingRow {...self} own />}
    </ol>
  );
};

const RatingRow = ({
  rank,
  player,
  rating,
  profile,
  own,
}: {
  rank: number | null;
  player: string;
  rating: string;
  profile: RatingProfile;
  own: boolean;
}) => (
  <li
    className={cn(
      "flex min-h-12 items-center gap-3 border-b border-kit-line px-1 last:border-b-0",
      own && "rounded-xl border border-kit-gold bg-kit-ground",
    )}
  >
    <span className="w-8 text-right font-ui text-[15px] font-bold tabular-nums text-kit-cream">
      {rank === null ? "—" : rank}
    </span>
    <span className="min-w-0 flex-1">
      <RatedOwner player={player} profile={profile} own={own} />
    </span>
    <RatingFigure rating={rating} />
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
