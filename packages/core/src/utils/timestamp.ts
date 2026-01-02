import { TickIds } from "@bibliothecadao/types";
import { configManager } from "..";

type TimestampSource = () => number;

const defaultTimestampSource: TimestampSource = () => Math.floor(Date.now() / 1000);
let timestampSource: TimestampSource = defaultTimestampSource;

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
