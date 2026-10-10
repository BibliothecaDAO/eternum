import { lazy, type ReactNode, Suspense, useState } from "react";

import { formatExact } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { formatDate, formatDuration } from "@/ui/design-system/kit/time";
import { cn } from "@/ui/design-system/atoms/lib/utils";

import { usePlayerHistory, useRealmsPlayer } from "../herald";
import { Loading } from "../loading";
import { ServiceFailure } from "../service-failure";
import { useNowSeconds } from "../use-now";
import { claimSeasonCall, environmentLedger, lordsOf } from "../value/ledger";
import { useLedgerPaused } from "../value/use-ledger-paused";
import { FailureLine } from "../sign-in/failure-line";
import { SEASON_PRIZE_WORDS } from "../words";
import { placeShares, type SeasonPrize, seasonSourcesOf, seasonState, useSeasonPrize } from "./blitz-season";

const WalletSign = lazy(() =>
  import("@/ui/modules/identity/wallet-actions").then((module) => ({ default: module.WalletSign })),
);

/** How many paid places the panel lists before the last one. */
const PLACES_SHOWN = 3;

/**
 * The Blitz season's prize on Season, from the player's own games: the newest season with a share still to claim, else
 * the newest season they played: the pool now and the time left,
 * what the first paid places and the last would take of it today; at the end the review hour, then the winner's claim
 * from the seat's wallet in that game. A ledger not deployed on this environment is said so.
 */
export const SeasonPrizePanel = () => {
  const { data: player } = useRealmsPlayer();
  const history = usePlayerHistory(player);
  const sources = seasonSourcesOf(history.data ?? []);
  const ledger = environmentLedger();
  const prize = useSeasonPrize(ledger, sources);
  const paused = useLedgerPaused(ledger);
  if (sources.length > 0 && !ledger) return <FailureLine line={SEASON_PRIZE_WORDS.unreadable} />;
  if (prize.isError) return <ServiceFailure service="ledger" error={prize.error} retry={() => void prize.refetch()} />;
  if (!prize.data) return null;
  return <Prize prize={prize.data} paused={paused === true} onClaimed={() => void prize.refetch()} />;
};

const Prize = ({ prize, paused, onClaimed }: { prize: SeasonPrize; paused: boolean; onClaimed: () => void }) => {
  const now = useNowSeconds();
  const [signing, setSigning] = useState(false);
  const state = seasonState(prize, now);
  const { season } = prize;
  const shares = placeShares(season.pool, season.participants, prize.curve);
  return (
    <section className="plate flex flex-col gap-4 p-5">
      <h2 className="flex items-center gap-2.5 border-b border-kit-line pb-3 font-ui text-[19px] text-kit-cream">
        <KitIcon code="Pl" size={26} />
        {SEASON_PRIZE_WORDS.title}
        <span className="ml-auto">
          <Chip
            icon={state === "running" ? "Cl" : "Lk"}
            word={state === "running" ? SEASON_PRIZE_WORDS.ends(formatDate(season.end)) : SEASON_PRIZE_WORDS.final}
          />
        </span>
      </h2>
      <div className="flex items-center gap-3.5">
        <KitIcon code="Lo" size={52} />
        <span className="flex flex-col">
          <span className="font-ui text-[15px] text-kit-muted">{SEASON_PRIZE_WORDS.pool}</span>
          <b className="font-body text-[38px] font-extrabold leading-none tabular-nums text-kit-gold2">
            {formatExact(lordsOf(season.pool))}
          </b>
        </span>
        <SeasonRing share={progress(season.start, season.end, now)} />
      </div>
      {state === "running" || state === "closing" ? (
        <Places shares={shares} />
      ) : (
        <Share prize={prize} state={state} now={now} />
      )}
      {state === "claim" && paused && <Line icon="Lk">{SEASON_PRIZE_WORDS.paused}</Line>}
      {state === "claim" &&
        !paused &&
        prize.position !== null &&
        (signing ? (
          <Suspense fallback={<Loading />}>
            <WalletSign
              owner={prize.wallet}
              calls={[claimSeasonCall(prize.ledger, prize.seasonId, prize.position)]}
              onLanded={() => {
                setSigning(false);
                onClaimed();
              }}
            />
          </Suspense>
        ) : (
          <Button role="primary" word={SEASON_PRIZE_WORDS.claim} icon="Tp" onClick={() => setSigning(true)} />
        ))}
    </section>
  );
};

/** What the first places and the last paid one would take if the season ended now. */
const Places = ({ shares }: { shares: bigint[] }) => {
  if (shares.length === 0) return <p className="font-body text-[15px] text-kit-muted">{SEASON_PRIZE_WORDS.noPlaces}</p>;
  const shown = shares.slice(0, PLACES_SHOWN).map((share, index) => ({ place: index + 1, share }));
  if (shares.length > PLACES_SHOWN) shown.push({ place: shares.length, share: shares[shares.length - 1] });
  return (
    <div className="flex flex-col">
      <p className="flex justify-between px-1 pb-1 font-ui text-[13px] text-kit-muted">
        <span>{SEASON_PRIZE_WORDS.paysToday}</span>
        <span>{SEASON_PRIZE_WORDS.placesPaid(shares.length)}</span>
      </p>
      {shown.map(({ place, share }, index) => (
        <p
          key={place}
          className={cn(
            "flex h-11 items-center border-b border-kit-line px-1 font-body text-[16px] last:border-b-0",
            index === PLACES_SHOWN && "border-t border-dashed border-t-kit-line2",
          )}
        >
          <KitIcon code="Tp" size={20} />
          <span className="ml-2 font-bold tabular-nums text-kit-cream">{SEASON_PRIZE_WORDS.place(place)}</span>
          <span className="ml-auto inline-flex items-center gap-1.5 font-extrabold tabular-nums text-kit-gold2">
            <KitIcon code="Lo" size={18} />
            {formatExact(lordsOf(share))}
          </span>
        </p>
      ))}
    </div>
  );
};

/** After the top list: the player's share, and where the season stands with it. */
const Share = ({ prize, state, now }: { prize: SeasonPrize; state: ReturnType<typeof seasonState>; now: number }) => {
  if (state === "out") return <Line icon="Tp">{SEASON_PRIZE_WORDS.notPaid}</Line>;
  const line: Record<string, ReactNode> = {
    review: (
      <Line icon="Hg">
        {SEASON_PRIZE_WORDS.review} <b>{formatDuration(prize.season.reviewUntil - now)}</b>
      </Line>
    ),
    held: <Line icon="Ey">{SEASON_PRIZE_WORDS.held}</Line>,
    claimed: <Line icon="Ok">{SEASON_PRIZE_WORDS.claimed}</Line>,
  };
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-kit-gold bg-kit-gold/5 px-4 py-3">
      <span className="font-ui text-[15px] text-kit-muted">{SEASON_PRIZE_WORDS.yourShare}</span>
      {prize.share !== null && (
        <b className="inline-flex items-center gap-2 font-body text-[32px] font-extrabold tabular-nums text-kit-cream">
          <KitIcon code="Lo" size={30} />
          {formatExact(lordsOf(prize.share))}
        </b>
      )}
      {line[state]}
    </div>
  );
};

const progress = (start: number, end: number, now: number) =>
  end > start ? Math.min(1, Math.max(0, (now - start) / (end - start))) : 1;

const SeasonRing = ({ share }: { share: number }) => {
  const length = 2 * Math.PI * 22;
  return (
    <svg viewBox="0 0 52 52" className="ml-auto size-14 -rotate-90" aria-hidden>
      <circle cx="26" cy="26" r="22" className="fill-kit-ink stroke-kit-line" strokeWidth="5" />
      <circle
        cx="26"
        cy="26"
        r="22"
        className="fill-none stroke-kit-gold"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - share)}
      />
    </svg>
  );
};

const Line = ({ icon, children }: { icon: IconCode; children: ReactNode }) => (
  <p className="flex items-center gap-2.5 font-body text-[16px] text-kit-cream">
    <KitIcon code={icon} size={22} />
    <span>{children}</span>
  </p>
);

const Chip = ({ icon, word }: { icon: IconCode; word: string }) => (
  <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-kit-line2 bg-kit-ink pl-1.5 pr-3 font-body text-[14px] font-bold text-kit-muted">
    <KitIcon code={icon} size={18} />
    {word}
  </span>
);
