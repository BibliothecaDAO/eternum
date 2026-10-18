import { SEASON_PRIZE_WORDS } from "@/ui/design-system/kit/words";
import { formatExact, formatDate, formatDuration } from "@bibliothecadao/types";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { lazy, type ReactNode, Suspense, useState } from "react";

import { AppButton, AppFigure } from "@/ui/design-system/kit/app-elements";

import { usePlayerHistory, useRealmsPlayer } from "../herald";
import { Loading } from "../loading";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { claimSeasonCall, environmentLedger, lordsOf } from "../value/ledger";
import { useLedgerPaused } from "../value/use-ledger-paused";
import { FailureLine } from "../sign-in/failure-line";
import { placeShares, type SeasonPrize, seasonSourcesOf, seasonState, useSeasonPrize } from "./blitz-season";

const WalletSign = lazy(() =>
  import("@/shell/value/wallet-actions").then((module) => ({ default: module.WalletSign })),
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
  <span className="flex items-center gap-2 text-app-label text-app-muted">
    {SEASON_PRIZE_WORDS.pool}
    <b className="inline-flex items-center gap-1 tabular-nums text-app-gold">
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
      <p className="flex justify-between gap-3 py-2 text-app-label text-app-muted">
        <span>{SEASON_PRIZE_WORDS.paysToday}</span>
        <span>{shares.length ? SEASON_PRIZE_WORDS.placesPaid(shares.length) : SEASON_PRIZE_WORDS.noPlaces}</span>
      </p>
    );
  return (
    <>
      <Share prize={prize} state={state} now={now} />
      {state === "claim" && paused && <PrizeLine icon="lock">{SEASON_PRIZE_WORDS.paused}</PrizeLine>}
      {state === "claim" && !paused && prize.position !== null && <Claim prize={prize} onClaimed={onClaimed} />}
    </>
  );
};

/** The claim: one signature from the seat's wallet. */
const Claim = ({ prize, onClaimed }: { prize: SeasonPrize; onClaimed: () => void }) => {
  const [signing, setSigning] = useState(false);
  if (!signing)
    return (
      <AppButton kind="primary" size="lg" icon="victory" step onClick={() => setSigning(true)}>
        {SEASON_PRIZE_WORDS.claim}
      </AppButton>
    );
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
  if (state === "out") return <PrizeLine icon="victory">{SEASON_PRIZE_WORDS.notPaid}</PrizeLine>;
  const line: Record<string, ReactNode> = {
    review: (
      <PrizeLine icon="hourglass">
        {SEASON_PRIZE_WORDS.review} <b>{formatDuration(prize.season.reviewUntil - now, { days: false })}</b>
      </PrizeLine>
    ),
    held: <PrizeLine icon="explore">{SEASON_PRIZE_WORDS.held}</PrizeLine>,
    claimed: <PrizeLine icon="check">{SEASON_PRIZE_WORDS.claimed}</PrizeLine>,
  };
  return (
    <div className="flex flex-col gap-3 py-3">
      <AppFigure
        icon="lords"
        tone="gold"
        value={prize.share !== null ? formatExact(lordsOf(prize.share)) : "—"}
        label={SEASON_PRIZE_WORDS.yourShare}
      />
      {line[state]}
    </div>
  );
};

/** A line of where the season's prize stands, by its icon. */
const PrizeLine = ({ icon, children }: { icon: IconMeaning; children: ReactNode }) => (
  <p role="status" className="flex items-center gap-2 text-app-body text-app-ink">
    <SemanticIcon name={icon} size={22} />
    <span>{children}</span>
  </p>
);
