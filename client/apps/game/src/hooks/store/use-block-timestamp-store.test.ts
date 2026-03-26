import { beforeEach, describe, expect, it, vi } from "vitest";

const { getBlockTimestampMock, getTickMock, blockTimestampState } = vi.hoisted(() => {
  const state = {
    currentBlockTimestamp: 120,
    currentDefaultTick: 120,
    currentArmiesTick: 2,
  };

  return {
    blockTimestampState: state,
    getBlockTimestampMock: vi.fn(() => ({ ...state })),
    getTickMock: vi.fn(() => 60),
  };
});

vi.mock("@bibliothecadao/eternum", () => ({
  configManager: {
    getTick: getTickMock,
  },
  getBlockTimestamp: getBlockTimestampMock,
}));

vi.mock("@bibliothecadao/types", () => ({
  TickIds: {
    Armies: "Armies",
  },
}));

import { useBlockTimestampStore } from "./use-block-timestamp-store";
import { useChainTimeStore } from "./use-chain-time-store";

describe("useBlockTimestampStore", () => {
  beforeEach(() => {
    blockTimestampState.currentBlockTimestamp = 120;
    blockTimestampState.currentDefaultTick = 120;
    blockTimestampState.currentArmiesTick = 2;

    getBlockTimestampMock.mockImplementation(() => ({ ...blockTimestampState }));
    getTickMock.mockImplementation(() => 60);

    useChainTimeStore.setState({
      lastHeartbeat: null,
      anchorTimestampMs: null,
      anchorPerfMs: null,
      nowMs: 120_000,
    });
    useBlockTimestampStore.getState().tick();
  });

  it("updates when chain time store advances", () => {
    expect(useBlockTimestampStore.getState()).toMatchObject({
      currentBlockTimestamp: 120,
      currentArmiesTick: 2,
      armiesTickTimeRemaining: 60,
    });

    blockTimestampState.currentBlockTimestamp = 180;
    blockTimestampState.currentDefaultTick = 180;
    blockTimestampState.currentArmiesTick = 3;

    useChainTimeStore.setState((state) => ({
      ...state,
      nowMs: 180_000,
    }));

    expect(useBlockTimestampStore.getState()).toMatchObject({
      currentBlockTimestamp: 180,
      currentArmiesTick: 3,
      armiesTickTimeRemaining: 60,
    });
  });
});
