import { TickIds } from "@bibliothecadao/types";
import { configManager } from "../managers/config-manager";

type TimestampSource = () => number;

/**
 * The client's running estimate of chain time: countdowns to known future times read it. It is bound from confirmed
 * heads; until one is known there is no chain time, and a reader fails by name instead of guessing a wall clock.
 */
let timestampSource: TimestampSource | null = null;
/** The newest confirmed head's time. Null until one is known. */
let chainProvenTimestampSource: (() => number | null) | null = null;

export const setBlockTimestampSource = (source: TimestampSource | null) => {
  timestampSource = source ? () => Math.floor(source()) : null;
};

/**
 * Production and stamina figures and action gates use the same chain-proven time. A transaction executes at or
 * after the newest confirmed head; the running estimate may lead it and cannot justify a balance.
 */
export const setChainProvenTimestampSource = (source: (() => number | null) | null) => {
  chainProvenTimestampSource = source;
};

const tickAt = (seconds: number, tick: TickIds) => {
  const interval = Number(configManager.getTick(tick));
  if (!Number.isFinite(interval) || interval <= 0) throw new Error(`Invalid tick interval for ${tick}`);
  return Math.floor(seconds / interval);
};

export const readDefaultTick = (): number | undefined => {
  if (!timestampSource) return undefined;
  const proven = chainProvenTimestampSource ? chainProvenTimestampSource() : timestampSource();
  return proven === null ? undefined : tickAt(proven, TickIds.Default);
};

export const getBlockTimestamp = () => {
  if (!timestampSource) throw new Error("Chain time is not known yet: no confirmed head has bound a clock");
  const timestamp = timestampSource();
  const provenTimestamp = chainProvenTimestampSource ? chainProvenTimestampSource() : timestamp;

  return {
    currentBlockTimestamp: timestamp,
    get currentDefaultTick() {
      if (provenTimestamp === null) throw new Error("No chain-proven timestamp for balances or stamina");
      return tickAt(provenTimestamp, TickIds.Default);
    },
    get currentArmiesTick() {
      return tickAt(timestamp, TickIds.Armies);
    },
  };
};
