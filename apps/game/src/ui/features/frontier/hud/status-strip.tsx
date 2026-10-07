import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatAmount } from "@/ui/design-system/kit/amount";
import { ClockLine } from "@/ui/design-system/kit/clock-line";
import { DayDial } from "@/ui/design-system/kit/day-dial";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { StoreBar } from "@/ui/design-system/kit/store-bar";
import { TONE_TEXT, type Tone } from "@/ui/design-system/kit/tone";
import { ESSENCE, LABOR, TROOPS, WHEAT } from "@/ui/design-system/kit/words";
import { useLandedValue, useLandingDelta } from "@/ui/motion/landing-hold";
import { EASE } from "@/ui/motion/motion-scale";
import { useReducedMotion } from "@/ui/motion/motion-settings";
import { TickNumber } from "@/ui/motion/tick-number";
import { AnimatePresence, motion } from "framer-motion";

import type { DayClock } from "./day-clock";

export type StoreKind = "essence" | "labor" | "wheat" | "troops";

/** One store on the strip: what it holds, its limit (Essence has none), its tone, and where payouts land on it. */
export type StoreReading = {
  kind: StoreKind;
  amount: number | undefined;
  limit: number | undefined;
  tone: Tone;
  flyTarget: string;
};

const STORES: Record<StoreKind, { icon: IconCode; word: string }> = {
  essence: { icon: "Es", word: ESSENCE },
  labor: { icon: "La", word: LABOR },
  wheat: { icon: "Wh", word: WHEAT },
  troops: { icon: "Tr", word: TROOPS },
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
  <header className="frontier-card pointer-events-auto flex flex-col !rounded-xl px-1.5 pb-1 font-sans">
    <div className="flex h-12 items-center gap-1.5">
      <span className="flex w-11 shrink-0 justify-center">
        <DayDial day={clock.day} shareLeft={clock.shareLeft} tone={clock.tone} />
      </span>
      <Stores stores={stores} onOpen={onOpenStores} />
    </div>
    <ClockLine
      endsAt={clock.endsAt}
      secondsLeft={clock.secondsLeft}
      tomorrowSeconds={clock.tomorrowSeconds}
      tone={clock.tone}
    />
  </header>
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

/** A store's plate: its icon and amount, rolling as it changes, over the bar of its limit. */
const StorePlate = ({ store }: { store: StoreReading }) => {
  const { icon, word } = STORES[store.kind];
  const shown = useLandedValue(store.flyTarget, store.amount);
  return (
    <span className="relative flex min-w-0 flex-1 flex-col justify-center gap-1 px-0.5">
      <LandingDelta target={store.flyTarget} />
      <span className="flex items-center justify-center gap-0.5">
        <span data-fly-target={store.flyTarget} className="inline-flex">
          <KitIcon code={icon} size={18} />
        </span>
        <span className="sr-only">{word}</span>
        <span className={cn("text-[15px] leading-none tabular-nums", TONE_TEXT[store.tone])}>
          {shown === undefined ? "—" : <TickNumber value={shown} format={formatAmount} />}
        </span>
      </span>
      <StoreBar amount={store.amount} limit={store.limit} tone={store.tone} />
    </span>
  );
};

/** A landing's "+N" shows this long, and never again when the counter remounts. */
const DELTA_MS = 1_400;
const delta = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** The plate's "+N" as a payout lands: it pops above the number and fades as it rises. */
const LandingDelta = ({ target }: { target: string }) => {
  const landing = useLandingDelta(target);
  const reduced = useReducedMotion();
  return (
    <AnimatePresence>
      {landing && performance.now() - landing.at < DELTA_MS && (
        <motion.span
          key={landing.at}
          aria-live="polite"
          className="pointer-events-none absolute -top-5 right-0 whitespace-nowrap text-sm font-semibold text-gold tabular-nums"
          initial={{ opacity: 0, y: 0, scale: reduced ? 1 : 0.8 }}
          animate={{ opacity: [0, 1, 1, 0], y: reduced ? 0 : -14, scale: 1 }}
          transition={{ duration: DELTA_MS / 1000, times: [0, 0.1, 0.7, 1], ease: EASE.outQuart }}
        >
          +{delta.format(landing.amount)}
        </motion.span>
      )}
    </AnimatePresence>
  );
};
