import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { readExpeditionRules, setBlockTimestampSource, setChainProvenTimestampSource } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { BlockTimestampPoller } from "@/ui/shared/components/block-timestamp-poller";
import { frontierDay } from "../deploy/deploy-fixture";
import { FrontierProduction } from "./frontier-production";

const context = vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
  return { store: null as NativeFactStore | null };
});
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: context.store } }) }));
vi.mock("../frontier-home", async (original) => ({
  ...(await original<typeof import("../frontier-home")>()),
  useGoToFrontierPlace: () => vi.fn(),
}));

afterEach(() => {
  setBlockTimestampSource(null);
  setChainProvenTimestampSource(null);
  vi.useRealTimers();
});

it("keeps an open barracks figure fixed until the chain-proven floor advances", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { store, row } = frontierDay();
  context.store = store;
  const rules = readExpeditionRules(store, 1)!;
  store.applyFacts([
    {
      model: "ResourceProduction",
      key: "0x99",
      value: {
        game_id: 1,
        entity_id: 7,
        resource_type: ResourcesIds.Knight,
        building_count: 1,
        production_rate: String(2 * RESOURCE_PRECISION),
        output_amount_left: String((1n << 128n) - 1n),
        last_settled_tick: 350,
      },
    },
  ]);
  useChainTimeStore.getState().anchor({ timestamp: 350_000 });
  setBlockTimestampSource(() => useChainTimeStore.getState().getNowSeconds());
  setChainProvenTimestampSource(() => useChainTimeStore.getState().executionFloorMs! / 1_000);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() =>
      root.render(
        <>
          <BlockTimestampPoller />
          <FrontierProduction realm={row} rules={rules} onClose={() => {}} />
        </>,
      ),
    );
    const troopRow = () => host.querySelectorAll("section[aria-label='Production'] > div > div")[2].textContent;
    expect(troopRow()).toContain("420");
    act(() => vi.advanceTimersByTime(1000));
    expect(troopRow()).toContain("420");
    act(() => vi.advanceTimersByTime(1000));
    expect(troopRow()).toContain("420");
    act(() => useChainTimeStore.getState().setHeartbeat({ timestamp: 352_000, preconfirmed: true }));
    expect(troopRow()).toContain("420");
    act(() => useChainTimeStore.getState().setHeartbeat({ timestamp: 352_000 }));
    expect(troopRow()).toContain("424");
    expect(useChainTimeStore.getState().executionFloorMs).toBe(352_000);
    expect(
      store.require("ResourceBalance", { game_id: 1, entity_id: 7, resource_type: ResourcesIds.Knight }).balance,
    ).toBe(420n * BigInt(RESOURCE_PRECISION));
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
