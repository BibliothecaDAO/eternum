import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBlockTimestampStore } from "@/hooks/store/use-block-timestamp-store";

import { BlockTimestampPoller } from "./block-timestamp-poller";

vi.mock("@bibliothecadao/eternum", () => ({
  configManager: {
    getTick: () => 1,
  },
  getBlockTimestamp: () => ({
    currentBlockTimestamp: 0,
    currentDefaultTick: 0,
    currentArmiesTick: 0,
  }),
}));

describe("BlockTimestampPoller", () => {
  let container: HTMLDivElement;
  let root: Root;
  let tickMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    tickMock = vi.fn();

    useBlockTimestampStore.setState({
      currentBlockTimestamp: 0,
      currentDefaultTick: 0,
      currentArmiesTick: 0,
      armiesTickTimeRemaining: 0,
      tick: tickMock,
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("refreshes the block timestamp store every second", async () => {
    await act(async () => {
      root.render(<BlockTimestampPoller />);
    });

    expect(tickMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(999);
    });

    expect(tickMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(tickMock).toHaveBeenCalledTimes(2);
  });
});
