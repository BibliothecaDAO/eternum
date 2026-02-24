import {useCallback, useEffect, useState} from 'react';

// TODO: Import from @bibliothecadao/eternum once full Dojo context is wired up
// import {configManager} from '@bibliothecadao/eternum';
// import {TickIds} from '@bibliothecadao/types';

interface BlockTimestampResult {
  currentBlockTimestamp: number;
  currentDefaultTick: number;
  currentArmiesTick: number;
}

const TICK_INTERVAL_MS = 10_000;

const computeTimestamps = (): BlockTimestampResult => {
  const timestamp = Math.floor(Date.now() / 1000);
  // TODO: Use configManager.getTick(TickIds.Default) and configManager.getTick(TickIds.Armies)
  return {
    currentBlockTimestamp: timestamp,
    currentDefaultTick: timestamp,
    currentArmiesTick: timestamp,
  };
};

export function useBlockTimestamp(): BlockTimestampResult {
  const [timestamps, setTimestamps] = useState<BlockTimestampResult>(
    computeTimestamps,
  );

  const tick = useCallback(() => {
    setTimestamps(computeTimestamps());
  }, []);

  useEffect(() => {
    const interval = setInterval(tick, TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [tick]);

  return timestamps;
}

export function getBlockTimestamp(): BlockTimestampResult {
  return computeTimestamps();
}
