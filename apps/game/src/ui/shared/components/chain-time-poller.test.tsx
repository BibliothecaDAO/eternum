import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { getBlockTimestamp, configManager } from "@bibliothecadao/eternum";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { ChainTimePoller } from "./chain-time-poller";

const HEAD_SECONDS = 1_787_000_000;
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.spyOn(configManager, "getTick").mockReturnValue(1);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
});

it("projects production at the newest chain-written timestamp while the clock runs on the estimate", async () => {
  await act(async () => root.render(<ChainTimePoller />));
  act(() => useChainTimeStore.getState().setHeartbeat({ timestamp: HEAD_SECONDS * 1000, source: "herald-head" }));

  const { currentBlockTimestamp, currentDefaultTick } = getBlockTimestamp();
  expect(currentDefaultTick).toBe(HEAD_SECONDS);
  expect(currentBlockTimestamp).toBeGreaterThanOrEqual(HEAD_SECONDS);
});
