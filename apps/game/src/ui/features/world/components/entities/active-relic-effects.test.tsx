import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import {
  configManager,
  formatTime,
  setBlockTimestampSource,
  setChainProvenTimestampSource,
} from "@bibliothecadao/eternum";
import { ResourcesIds, TickIds } from "@bibliothecadao/types";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { BlockTimestampPoller } from "@/ui/shared/components/block-timestamp-poller";
import { ActiveRelicEffects } from "./active-relic-effects";

vi.mock("@/ui/design-system/molecules/resource-icon", () => ({ ResourceIcon: () => null }));
afterEach(() => {
  setBlockTimestampSource(null);
  setChainProvenTimestampSource(null);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("shows remaining seconds only as the proven floor advances, and removes the expired bonus", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
  vi.spyOn(configManager, "getTick").mockImplementation((id) => (id === TickIds.Default ? 1 : 60));
  useChainTimeStore.getState().anchor({ timestamp: 47_000 });
  setBlockTimestampSource(() => useChainTimeStore.getState().getNowSeconds());
  setChainProvenTimestampSource(() => useChainTimeStore.getState().executionFloorMs! / 1_000);
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    act(() =>
      root.render(
        <>
          <BlockTimestampPoller />
          <ActiveRelicEffects entityId={1} relicEffects={[{ id: ResourcesIds.DamageRelic1, endAt: 77 }]} />
        </>,
      ),
    );
    expect(host.textContent).toContain(`${formatTime(30)} left`);
    act(() => vi.advanceTimersByTime(10_000));
    expect(host.textContent).toContain(`${formatTime(30)} left`);
    act(() => useChainTimeStore.getState().setHeartbeat({ timestamp: 76_000, preconfirmed: true }));
    expect(host.textContent).toContain(`${formatTime(30)} left`);
    act(() => useChainTimeStore.getState().setHeartbeat({ timestamp: 76_000 }));
    expect(host.textContent).toContain(`${formatTime(1)} left`);
    act(() => useChainTimeStore.getState().setHeartbeat({ timestamp: 77_000 }));
    expect(host.textContent).toBe("");
  } finally {
    act(() => root.unmount());
  }
});
