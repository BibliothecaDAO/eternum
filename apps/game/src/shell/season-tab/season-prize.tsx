import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { lazy, type ReactNode, Suspense, useState } from "react";

import { formatExact } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { IconLine } from "@/ui/design-system/kit/icon-line";

import { formatDate, formatDuration } from "@/ui/design-system/kit/time";

import { usePlayerHistory, useRealmsPlayer } from "../herald";
import { Loading } from "../loading";
import { ServiceFailure } from "../service-failure";
import { claimSeasonCall, environmentLedger, lordsOf } from "../value/ledger";
import { useLedgerPaused } from "../value/use-ledger-paused";
import { FailureLine } from "../sign-in/failure-line";
import { SEASON_PRIZE_WORDS } from "../words";
import { placeShares, type SeasonPrize, seasonSourcesOf, seasonState, useSeasonPrize } from "./blitz-season";

const WalletSign = lazy(() =>
  import("@/ui/modules/identity/wallet-actions").then((module) => ({ default: module.WalletSign })),
);

/**
 * The Blitz season's prize as the rating board shows it, from the player's own games: the newest season with a share
 * still to claim, else the newest season they played. While it runs, `shares` is what each rating place would take if
 * it ended now (the ledger pays the posted rating list by place); once it is over, the board shows the player's share.
 */
export const useBoardPrize = (now: number) => {
  const { data: player } = useRealmsPlayer();
  const history = usePlayerHistory(player);
  const sources = seasonSourcesOf(history.data ?? []);
  const ledger = environmentLedger();
  const query = useSeasonPrize(ledger, sources);
  const paused = useLedgerPaused(ledger) === true;
  const prize = query.data ?? null;
  const state = prize ? seasonState(prize, now) : null;
  const shares =
    prize && (state === "running" || state === "closing")
      ? placeShares(prize.season.pool, prize.season.participants, prize.curve)
      : null;
  return { history, query, unreadable: sources.length > 0 && !ledger, prize, state, shares, paused };
};

type BoardPrize = ReturnType<typeof useBoardPrize>;

/** The board's figure at its title: the pool, and when the season ends, or Final. */
export const PrizeHead = ({ prize, state }: { prize: SeasonPrize; state: BoardPrize["state"] }) => (
  <span className="flex items-center gap-2 font-body text-sm font-normal text-kit-muted">
    {SEASON_PRIZE_WORDS.pool}
    <b className="inline-flex items-center gap-1 text-base tabular-nums text-kit-gold2">
      <SemanticIcon name="lords" size={18} />
      {formatExact(lordsOf(prize.season.pool))}
    </b>
    · {state === "running" ? SEASON_PRIZE_WORDS.ends(formatDate(prize.season.end)) : SEASON_PRIZE_WORDS.final}
  </span>
);

/**
 * What stands above the board's rows: while the season runs, how many places it pays; once it is over, the player's
 * share and where the season stands with it, then the winner's claim from the seat's wallet in that game. A prize that
 * cannot be read, from the player's games or the ledger, says so, and one on its way shows its wait.
 */
export const PrizeLines = ({
  prize: board,
  now,
  onClaimed,
}: {
  prize: BoardPrize;
  now: number;
  onClaimed: () => void;
}) => {
  const { history, query, unreadable, prize, state, shares, paused } = board;
  if (history.isError)
    return <ServiceFailure service="directory" error={history.error} retry={() => void history.refetch()} />;
  if (unreadable) return <FailureLine line={SEASON_PRIZE_WORDS.unreadable} />;
  if (query.isError) return <ServiceFailure service="ledger" error={query.error} retry={() => void query.refetch()} />;
  if (history.isLoading || query.isLoading) return <Loading />;
  if (!prize || !state) return null;
  if (shares)
    return (
      <p className="flex justify-between px-1 pt-1 font-body text-sm text-kit-muted">
        <span>{SEASON_PRIZE_WORDS.paysToday}</span>
        <span>{shares.length ? SEASON_PRIZE_WORDS.placesPaid(shares.length) : SEASON_PRIZE_WORDS.noPlaces}</span>
      </p>
    );
  return (
    <>
      <Share prize={prize} state={state} now={now} />
      {state === "claim" && paused && (
        <IconLine tone="cream" iconSize={22} icon="lock">
          {SEASON_PRIZE_WORDS.paused}
        </IconLine>
      )}
      {state === "claim" && !paused && prize.position !== null && <Claim prize={prize} onClaimed={onClaimed} />}
    </>
  );
};

/** The claim: one signature from the seat's wallet. */
const Claim = ({ prize, onClaimed }: { prize: SeasonPrize; onClaimed: () => void }) => {
  const [signing, setSigning] = useState(false);
  if (!signing)
    return <Button role="primary" word={SEASON_PRIZE_WORDS.claim} icon="victory" onClick={() => setSigning(true)} />;
  return (
    <Suspense fallback={<Loading />}>
      <WalletSign
        owner={prize.wallet}
        calls={[claimSeasonCall(prize.ledger, prize.seasonId, prize.position!)]}
        onLanded={() => {
          setSigning(false);
          onClaimed();
        }}
      />
    </Suspense>
  );
};

/** After the season: the player's share, and where the season stands with it. */
const Share = ({ prize, state, now }: { prize: SeasonPrize; state: NonNullable<BoardPrize["state"]>; now: number }) => {
  if (state === "out")
    return (
      <IconLine tone="cream" iconSize={22} icon="victory">
        {SEASON_PRIZE_WORDS.notPaid}
      </IconLine>
    );
  const line: Record<string, ReactNode> = {
    review: (
      <IconLine tone="cream" iconSize={22} icon="hourglass">
        {SEASON_PRIZE_WORDS.review} <b>{formatDuration(prize.season.reviewUntil - now)}</b>
      </IconLine>
    ),
    held: (
      <IconLine tone="cream" iconSize={22} icon="explore">
        {SEASON_PRIZE_WORDS.held}
      </IconLine>
    ),
    claimed: (
      <IconLine tone="cream" iconSize={22} icon="check">
        {SEASON_PRIZE_WORDS.claimed}
      </IconLine>
    ),
  };
  return (
    <div className="flex flex-col gap-2 rounded-well border border-kit-gold bg-kit-gold/5 px-4 py-3">
      <span className="font-body text-base text-kit-muted">{SEASON_PRIZE_WORDS.yourShare}</span>
      {prize.share !== null && (
        <b className="inline-flex items-center gap-2 font-body text-title font-extrabold tabular-nums text-kit-cream">
          <SemanticIcon name="lords" size={30} />
          {formatExact(lordsOf(prize.share))}
        </b>
      )}
      {line[state]}
    </div>
  );
};
