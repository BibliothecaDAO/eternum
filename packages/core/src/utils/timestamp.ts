import { TickIds } from "@bibliothecadao/types";
// Imported from the concrete module, not a barrel: barrel cycles leave this
// module's consumers with uninitialized re-export bindings. configManager is
// only dereferenced at call time, which keeps the remaining cycle harmless.
import { configManager } from "../managers/config-manager";

type TimestampSource = () => number;

const defaultTimestampSource: TimestampSource = () => Math.floor(Date.now() / 1000);
/** The client's running estimate of chain time: clocks, cooldowns and stamina read it. */
let timestampSource: TimestampSource = defaultTimestampSource;
/** The newest timestamp the chain itself has written (a closed head or a row). Null until one is known. */
let chainProvenTimestampSource: (() => number | null) | null = null;

// Small extra buffer for automation projections — clock-jitter insurance only.
// The Aug 19 playtest proved buffer depth cannot fix automation reverts: with
// zero player transactions the projection diverged from chain lazy-harvest
// math and the shortfall GREW over the hour. The real repair is the
// revert→resync→replan chokepoint in use-automation (refetch the realm's
// Resource rows on an Insufficient Balance revert so the next plan starts
// from chain truth). Owner ruling: keep 3s as a belt, never deepen it again.
const CONSERVATIVE_TICK_BUFFER_AUTOMATION = 3;

export const setBlockTimestampSource = (source: TimestampSource | null) => {
  timestampSource = source ? () => Math.floor(source()) : defaultTimestampSource;
};

/**
 * Production is projected at chain-proven time, never at the estimate. A transaction executes at or after the
 * newest chain-written timestamp, so a balance projected there is a floor on what the chain will hold; the
 * estimate can lead the executing block by seconds and a MAX taken from it reverts.
 */
export const setChainProvenTimestampSource = (source: (() => number | null) | null) => {
  chainProvenTimestampSource = source;
};

// A chain-written timestamp ahead of the local chain-time estimate is proof the
// chain's clock has reached that moment. Reporting it lets the clock re-anchor
// instead of silently under-reporting elapsed time (the invariant the display
// math needs is client-time >= every last_updated_at the client holds).
type ChainTimestampEvidenceSink = (timestampSeconds: number) => void;
let chainTimestampEvidenceSink: ChainTimestampEvidenceSink | null = null;

export const setChainTimestampEvidenceSink = (sink: ChainTimestampEvidenceSink | null) => {
  chainTimestampEvidenceSink = sink;
};

export const reportObservedChainTimestamp = (timestampSeconds: number) => {
  if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) return;
  chainTimestampEvidenceSink?.(timestampSeconds);
};

export const getBlockTimestamp = () => {
  const timestamp = timestampSource();
  const provenTimestamp = chainProvenTimestampSource?.() ?? timestamp;
  const tickConfigArmies = configManager.getTick(TickIds.Armies);
  const tickConfigDefault = configManager.getTick(TickIds.Default);

  // Config not hydrated yet reads as interval 0; report tick 0 (not Infinity) until it lands.
  const tickOrZero = (seconds: number, interval: number) =>
    Number.isFinite(interval) && interval > 0 ? Math.floor(seconds / interval) : 0;
  const currentDefaultTick = tickOrZero(provenTimestamp, Number(tickConfigDefault));
  const currentArmiesTick = tickOrZero(timestamp, Number(tickConfigArmies));

  return {
    currentBlockTimestamp: timestamp,
    currentDefaultTick,
    currentArmiesTick,
  };
};

/**
 * Projection tick for automation plan building. Carries a slightly deeper
 * jitter belt than the UI accessor, but reverts are NOT prevented here: the
 * projection can diverge from chain lazy-harvest math regardless of buffer
 * depth, and automation repairs that with its revert→resync chokepoint
 * (see CONSERVATIVE_TICK_BUFFER_AUTOMATION).
 */
export const getAutomationProjectionTick = () => {
  const { currentBlockTimestamp, currentDefaultTick, currentArmiesTick } = getBlockTimestamp();

  return {
    currentBlockTimestamp,
    currentDefaultTick: Math.max(0, currentDefaultTick - CONSERVATIVE_TICK_BUFFER_AUTOMATION),
    currentArmiesTick: Math.max(0, currentArmiesTick - CONSERVATIVE_TICK_BUFFER_AUTOMATION),
  };
};
