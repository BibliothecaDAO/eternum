// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";
import {
  getAutomationProjectionTick,
  getBlockTimestamp,
  setBlockTimestampSource,
  setChainProvenTimestampSource,
} from "./timestamp";

// getTick(Default) is a fixed 1s, so ticks equal source seconds and the
// buffers are directly observable as tick differences.
const SOURCE_SECONDS = 1_787_000_000;

afterEach(() => {
  setBlockTimestampSource(null);
  setChainProvenTimestampSource(null);
});

describe("chain time", () => {
  it("projects production at chain-proven time while clocks keep the estimate", () => {
    setBlockTimestampSource(() => SOURCE_SECONDS + 4);
    setChainProvenTimestampSource(() => SOURCE_SECONDS);

    const { currentBlockTimestamp, currentDefaultTick } = getBlockTimestamp();
    expect(currentBlockTimestamp).toBe(SOURCE_SECONDS + 4);
    expect(currentDefaultTick).toBe(SOURCE_SECONDS);
  });

  it("falls back to the estimate until the chain has written a timestamp", () => {
    setBlockTimestampSource(() => SOURCE_SECONDS);
    setChainProvenTimestampSource(() => null);

    expect(getBlockTimestamp().currentDefaultTick).toBe(SOURCE_SECONDS);
  });

  it("holds the automation projection 3s behind the proven tick — jitter belt under the revert-resync chokepoint", () => {
    setBlockTimestampSource(() => SOURCE_SECONDS + 4);
    setChainProvenTimestampSource(() => SOURCE_SECONDS);

    expect(getAutomationProjectionTick().currentDefaultTick).toBe(SOURCE_SECONDS - 3);
  });
});
