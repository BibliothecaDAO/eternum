import { TickIds } from "@bibliothecadao/types";
// Imported from the concrete module, not a barrel: barrel cycles leave this
// module's consumers with uninitialized re-export bindings. configManager is
// only dereferenced at call time, which keeps the remaining cycle harmless.
import { configManager } from "../managers/config-manager";

type TimestampSource = () => number;

const defaultTimestampSource: TimestampSource = () => Math.floor(Date.now() / 1000);
let timestampSource: TimestampSource = defaultTimestampSource;

// Conservative buffer in ticks to account for client-chain clock desync.
// This ensures validation uses a tick slightly behind the displayed tick,
// preventing tx failures when client clock is ahead of chain.
const CONSERVATIVE_TICK_BUFFER = 1;

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
  const tickConfigArmies = configManager.getTick(TickIds.Armies);
  const tickConfigDefault = configManager.getTick(TickIds.Default);

  // Config not hydrated yet reads as interval 0; report tick 0 (not Infinity) until it lands.
  const tickOrZero = (interval: number) =>
    Number.isFinite(interval) && interval > 0 ? Math.floor(timestamp / interval) : 0;
  const currentDefaultTick = tickOrZero(Number(tickConfigDefault));
  const currentArmiesTick = tickOrZero(Number(tickConfigArmies));

  return {
    currentBlockTimestamp: timestamp,
    currentDefaultTick,
    currentArmiesTick,
  };
};

/**
 * Returns conservative tick values for transaction validation.
 * Subtracts a buffer from the current tick to account for potential
 * client-chain clock desync, ensuring resources are validated against
 * a slightly earlier tick to prevent tx failures.
 */
export const getConservativeBlockTimestamp = () => {
  const { currentBlockTimestamp, currentDefaultTick, currentArmiesTick } = getBlockTimestamp();

  return {
    currentBlockTimestamp,
    currentDefaultTick: Math.max(0, currentDefaultTick - CONSERVATIVE_TICK_BUFFER),
    currentArmiesTick: Math.max(0, currentArmiesTick - CONSERVATIVE_TICK_BUFFER),
  };
};

/**
 * Projection tick for automation plan building. Uses a deeper buffer than the
 * default conservative accessor so the projected balance stays behind what the
 * chain will report at tx-inclusion time, preventing Insufficient Balance reverts.
 */
export const getAutomationProjectionTick = () => {
  const { currentBlockTimestamp, currentDefaultTick, currentArmiesTick } = getBlockTimestamp();

  return {
    currentBlockTimestamp,
    currentDefaultTick: Math.max(0, currentDefaultTick - CONSERVATIVE_TICK_BUFFER_AUTOMATION),
    currentArmiesTick: Math.max(0, currentArmiesTick - CONSERVATIVE_TICK_BUFFER_AUTOMATION),
  };
};
