import { formatAmount, formatExact, formatDuration, formatRate } from "@bibliothecadao/types";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudDial, HudMeter, HudPanel } from "@/ui/design-system/kit/hud-elements";
import type { Tone } from "@/ui/design-system/kit/tone";
import {
  DAY,
  ESSENCE,
  FULL,
  FULL_IN,
  LABOR,
  OF,
  TROOPS,
  WHEAT,
  dayEnds,
  dayLeft,
  phraseText,
  tomorrowLasts,
} from "@/ui/design-system/kit/words";
import { useLandedValue, useLandingDelta } from "@/ui/motion/landing-hold";
import { EASE } from "@/ui/motion/motion-scale";
import { useReducedMotion } from "@/ui/motion/motion-settings";
import { TickNumber } from "@/ui/motion/tick-number";
import { AnimatePresence, motion } from "framer-motion";

import type { DayClock } from "./day-clock";

export type StoreKind = "essence" | "labor" | "wheat" | "troops";

/**
 * One store on the strip: what it holds, its limit (Essence has none), its rate an hour and when it is full (0 once it
 * is), its tone, and where payouts land on it.
 */
export type StoreReading = {
  kind: StoreKind;
  amount: number | undefined;
  limit: number | undefined;
  perHour?: number;
  fullIn?: number;
  tone: Tone;
  flyTarget: string;
};

/** A store's tone on the sheet: calm reads as ink, within the hour as warn, at the limit as bad. */
export const STORE_TONES: Record<Tone, { text: string; meter: "warn" | "bad" | undefined }> = {
  calm: { text: "text-hud-ink", meter: undefined },
  amber: { text: "text-hud-warn", meter: "warn" },
  ember: { text: "text-hud-bad", meter: "bad" },
};

export const STORES: Record<StoreKind, { icon: IconMeaning; word: string }> = {
  essence: { icon: "essence", word: ESSENCE },
  labor: { icon: "labor", word: LABOR },
  wheat: { icon: "wheat", word: WHEAT },
  troops: { icon: "troops", word: TROOPS },
};

/**
 * The strip across the top of every Frontier screen: the day's dial, the four stores against their limits, and the
 * clock line under them. A tap on the stores opens Production when the host gives the way there.
 */
export const StatusStrip = ({
  clock,
  stores,
  onOpenStores,
}: {
  clock: DayClock;
  stores: StoreReading[];
  onOpenStores?: () => void;
}) => (
  <HudPanel collapsible={false} bodyClassName="flex flex-col">
    <div className="flex h-12 items-center gap-1.5">
      <span className="flex w-11 shrink-0 justify-center">
        <HudDial
          value={clock.day ?? "—"}
          share={clock.shareLeft ?? 0}
          tone={STORE_TONES[clock.tone].meter}
          label={clock.day === undefined ? DAY : `${DAY} ${clock.day}`}
        />
      </span>
      <Stores stores={stores} onOpen={onOpenStores} />
    </div>
    <DayClockLine clock={clock} />
  </HudPanel>
);

/** The day's clock in words, in the day's tone: "Day ends 21:40 · 7h 14m left · Tomorrow lasts 12h"; unknown a dash. */
const DayClockLine = ({ clock }: { clock: DayClock }) => (
  <p
    role="timer"
    className={cn(
      "flex flex-wrap items-baseline justify-center gap-x-1 text-hud-label tabular-nums",
      STORE_TONES[clock.tone].text,
    )}
  >
    <span>{phraseText(dayEnds(clock.endsAt))}</span>
    <span aria-hidden>·</span>
    <span>{phraseText(dayLeft(clock.secondsLeft))}</span>
    <span aria-hidden>·</span>
    <span>{phraseText(tomorrowLasts(clock.tomorrowSeconds))}</span>
  </p>
);

const Stores = ({ stores, onOpen }: { stores: StoreReading[]; onOpen?: () => void }) => {
  const plates = stores.map((store) => <StorePlate key={store.kind} store={store} />);
  const layout = "flex h-full min-w-0 flex-1 items-stretch gap-1";
  return onOpen ? (
    <button type="button" onClick={onOpen} className={layout}>
      {plates}
    </button>
  ) : (
    <div className={layout}>{plates}</div>
  );
};

/**
 * A store in one line, as its plate says it when asked: "Wheat 1,771 of 6,000 · +5/min · Full in 14h". Each part
 * is there only when the game's facts give it; a full store says Full in place of a rate it no longer earns.
 */
export const storeLine = ({ kind, amount, limit, perHour, fullIn }: StoreReading): string => {
  const held = `${STORES[kind].word} ${formatExact(amount)}`;
  if (limit === undefined) return held;
  const against = `${held} ${OF} ${formatExact(limit)}`;
  if (fullIn === 0) return `${against} · ${FULL}`;
  const rate = perHour !== undefined && perHour > 0 ? ` · ${formatRate(perHour / 3600)}` : "";
  return `${against}${rate}${fullIn === undefined ? "" : ` · ${FULL_IN} ${formatDuration(fullIn, { days: false })}`}`;
};

/**
 * A store's plate: its icon and amount, rolling as it changes, over the bar of its limit. Its line is its one name:
 * what a screen reader says and what the tooltip shows.
 */
const StorePlate = ({ store }: { store: StoreReading }) => {
  const { icon } = STORES[store.kind];
  const shown = useLandedValue(store.flyTarget, store.amount);
  return (
    <span className="relative flex min-w-0 flex-1">
      <LandingDelta target={store.flyTarget} />
      <span
        role="img"
        aria-label={storeLine(store)}
        className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-0.5"
      >
        <span className="flex items-center justify-center gap-0.5">
          <span data-fly-target={store.flyTarget} className="inline-flex">
            <SemanticIcon name={icon} size={18} />
          </span>
          <span className={cn("text-hud-body leading-none tabular-nums", STORE_TONES[store.tone].text)}>
            {shown === undefined ? "—" : <TickNumber value={shown} format={formatAmount} />}
          </span>
        </span>
        <StoreMeter store={store} />
      </span>
    </span>
  );
};

/** How full a store is against its limit; a store with no limit (Essence) keeps the bar's room so the plates align. */
const StoreMeter = ({ store }: { store: StoreReading }) =>
  store.limit === undefined ? (
    <span aria-hidden className="block h-1 w-full" />
  ) : (
    <HudMeter
      share={store.amount === undefined || store.limit <= 0 ? 0 : store.amount / store.limit}
      tone={STORE_TONES[store.tone].meter}
      label={STORES[store.kind].word}
    />
  );

/** A landing's "+N" shows this long, and never again when the counter remounts. */
const DELTA_MS = 1_400;

/** The plate's "+N" as a payout lands: it pops above the number and fades as it rises. */
export const LandingDelta = ({ target }: { target: string }) => {
  const landing = useLandingDelta(target);
  const reduced = useReducedMotion();
  return (
    <AnimatePresence>
      {landing && performance.now() - landing.at < DELTA_MS && (
        <motion.span
          key={landing.at}
          aria-live="polite"
          className="pointer-events-none absolute -top-5 right-0 whitespace-nowrap text-hud-strong text-hud-ink tabular-nums"
          initial={{ opacity: 0, y: 0, scale: reduced ? 1 : 0.8 }}
          animate={{ opacity: [0, 1, 1, 0], y: reduced ? 0 : -14, scale: 1 }}
          transition={{ duration: DELTA_MS / 1000, times: [0, 0.1, 0.7, 1], ease: EASE.outQuart }}
        >
          +{formatAmount(landing.amount)}
        </motion.span>
      )}
    </AnimatePresence>
  );
};
