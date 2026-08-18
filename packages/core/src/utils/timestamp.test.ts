// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";
import {
  getAutomationProjectionTick,
  getBlockTimestamp,
  getConservativeBlockTimestamp,
  setBlockTimestampSource,
} from "./timestamp";

// getTick(Default) is a fixed 1s, so ticks equal source seconds and the
// buffers are directly observable as tick differences.
const SOURCE_SECONDS = 1_787_000_000;

afterEach(() => setBlockTimestampSource(null));

describe("tick buffers", () => {
  it("holds the automation projection 5s behind the clock — mirrors the chain-time lead cap", () => {
    setBlockTimestampSource(() => SOURCE_SECONDS);
    const { currentDefaultTick } = getBlockTimestamp();

    expect(getAutomationProjectionTick().currentDefaultTick).toBe(currentDefaultTick - 5);
  });

  it("keeps the UI validation buffer at 1s — only automation gets the deep buffer", () => {
    setBlockTimestampSource(() => SOURCE_SECONDS);
    const { currentDefaultTick } = getBlockTimestamp();

    expect(getConservativeBlockTimestamp().currentDefaultTick).toBe(currentDefaultTick - 1);
  });
});
