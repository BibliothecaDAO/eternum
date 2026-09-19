import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { WorldCountdownDetailed } from "./world-countdown";

describe("landing countdown before game entry", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.setSystemTime(100000);
    useChainTimeStore.setState({ lastHeartbeat: null, anchorTimestampMs: null, anchorPerfMs: null, nowMs: 100000 });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
  });
  it("advances and ends from the shared clock without a game timestamp poller", async () => {
    await act(async () => root.render(<WorldCountdownDetailed startMainAt={90} endAt={103} status="ok" />));
    expect(container.textContent).toContain("00:00:03 left");
    await act(async () => {
      vi.setSystemTime(102000);
      useChainTimeStore.getState().tick();
    });
    expect(container.textContent).toContain("00:00:01 left");
    await act(async () => {
      vi.setSystemTime(103000);
      useChainTimeStore.getState().tick();
    });
    expect(container.textContent).toContain("Ended at");
  });
  it("transitions from upcoming to ongoing on the same clock", async () => {
    await act(async () => root.render(<WorldCountdownDetailed startMainAt={101} endAt={110} status="ok" />));
    expect(container.textContent).toBe("Starts in 00:00:01");
    await act(async () => {
      vi.setSystemTime(101000);
      useChainTimeStore.getState().tick();
    });
    expect(container.textContent).toBe("Ongoing — 00:00:09 left");
  });
});
