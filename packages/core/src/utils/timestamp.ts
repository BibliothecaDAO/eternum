import { TickIds } from "@bibliothecadao/types";
import { configManager } from "..";

type TimestampSource = () => number;

const defaultTimestampSource: TimestampSource = () => Math.floor(Date.now() / 1000);
let timestampSource: TimestampSource = defaultTimestampSource;

// Conservative buffer in ticks to account for client-chain clock desync.
// This ensures validation uses a tick slightly behind the displayed tick,
// preventing tx failures when client clock is ahead of chain.
const CONSERVATIVE_TICK_BUFFER = 1;

// Deeper buffer used specifically for automation projections. Automation plans
// spend up to AUTOMATION_INPUT_BUDGET_PERCENT of a projected balance, so any
// overshoot in the projection (wall-clock drift, torii lag, tx-queue wait before
// block inclusion) directly causes on-chain "Insufficient Balance" reverts.
// Holding the projection further behind chain time widens the safety margin.
const CONSERVATIVE_TICK_BUFFER_AUTOMATION = 3;

export const setBlockTimestampSource = (source: TimestampSource | null) => {
  timestampSource = source ? () => Math.floor(source()) : defaultTimestampSource;
};

export const getBlockTimestamp = () => {
  const timestamp = timestampSource();
  const tickConfigArmies = configManager.getTick(TickIds.Armies);
  const tickConfigDefault = configManager.getTick(TickIds.Default);

  const currentDefaultTick = Math.floor(timestamp / Number(tickConfigDefault));
  const currentArmiesTick = Math.floor(timestamp / Number(tickConfigArmies));

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
