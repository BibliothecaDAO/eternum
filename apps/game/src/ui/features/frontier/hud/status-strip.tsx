import { formatAmount, formatExact, formatDuration, formatRate } from "@bibliothecadao/types";
import type { Tone } from "@/ui/design-system/kit/tone";
import { FULL, FULL_IN, OF } from "@/ui/design-system/kit/words";
import { useLandingDelta } from "@/ui/motion/landing-hold";
import { EASE } from "@/ui/motion/motion-scale";
import { useReducedMotion } from "@/ui/motion/motion-settings";
import { AnimatePresence, motion } from "framer-motion";

import { FRONTIER_STORES, type StoreKind } from "../stores";

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

/**
 * A store in one line, as its plate says it when asked: "Wheat 1,771 of 6,000 · +5/min · Full in 14h". Each part
 * is there only when the game's facts give it; a full store says Full in place of a rate it no longer earns.
 */
export const storeCapacityShare = (store: StoreReading): number | undefined => {
  if (store.limit === undefined || store.limit <= 0) return undefined;
  if (store.amount === undefined) return 0;
  return Math.min(1, Math.max(0, store.amount / store.limit));
};

export const storeRateText = (store: StoreReading, { compact = false }: { compact?: boolean } = {}): string | null => {
  if (store.perHour === undefined || store.perHour <= 0 || store.fullIn === 0) return null;
  const rate = formatRate(store.perHour / 3600);
  return compact ? rate.replace(/\/min$/, "") : rate;
};

export const storeLine = (store: StoreReading): string => {
  const { kind, amount, limit, fullIn } = store;
  const held = `${FRONTIER_STORES[kind].word} ${formatExact(amount)}`;
  if (limit === undefined) return held;
  const against = `${held} ${OF} ${formatExact(limit)}`;
  if (fullIn === 0) return `${against} · ${FULL}`;
  const rate = storeRateText(store);
  return `${against}${rate ? ` · ${rate}` : ""}${fullIn === undefined ? "" : ` · ${FULL_IN} ${formatDuration(fullIn, { days: false })}`}`;
};

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
