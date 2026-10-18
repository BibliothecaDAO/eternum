import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import {
  configManager,
  getArmyRelicEffects,
  getStructureArmyRelicEffects,
  getStructureRelicEffects,
  setBlockTimestampSource,
  setChainProvenTimestampSource,
} from "@bibliothecadao/eternum";
import { getRelicInfo, ResourcesIds, TickIds, type Troops, formatWait } from "@bibliothecadao/types";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
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
    expect(host.textContent).toContain(`${formatWait(30)} left`);
    act(() => vi.advanceTimersByTime(10_000));
    expect(host.textContent).toContain(`${formatWait(30)} left`);
    act(() => useChainTimeStore.getState().setHeartbeat({ timestamp: 76_000, preconfirmed: true }));
    expect(host.textContent).toContain(`${formatWait(30)} left`);
    act(() => useChainTimeStore.getState().setHeartbeat({ timestamp: 76_000 }));
    expect(host.textContent).toContain(`${formatWait(1)} left`);
    act(() => useChainTimeStore.getState().setHeartbeat({ timestamp: 77_000 }));
    expect(host.textContent).toBe("");
  } finally {
    act(() => root.unmount());
  }
});

it("renders every relic family from its facts and replaces the displayed expiry", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(configManager, "getTick").mockImplementation((id) => (id === TickIds.Default ? 1 : 60));
  useChainTimeStore.getState().anchor({ timestamp: 47_000 });
  setBlockTimestampSource(() => useChainTimeStore.getState().getNowSeconds());
  setChainProvenTimestampSource(() => useChainTimeStore.getState().executionFloorMs! / 1_000);
  let army: Troops = {
    category: "Knight",
    tier: "T1",
    count: 100n,
    battle_cooldown_end: 0,
    stamina: { amount: 10n, settled_at: 47, remainder: 0 },
    boosts: {
      incr_damage_dealt_percent_num: 2000,
      incr_damage_dealt_end_at: 77,
      decr_damage_gotten_percent_num: 2000,
      decr_damage_gotten_end_at: 77,
      incr_explore_reward_percent_num: 10000,
      incr_explore_reward_end_at: 77,
      incr_stamina_regen_percent_num: 5000,
      incr_stamina_regen_seconds_left: 30,
    },
  };
  const production = {
    game_id: 1,
    entity_id: 2n,
    incr_resource_rate_percent_num: 2000,
    incr_resource_rate_end_at: 77,
    incr_labor_rate_percent_num: 2000,
    incr_labor_rate_end_at: 77,
    incr_troop_rate_percent_num: 1500,
    incr_troop_rate_end_at: 77,
  };
  const Effects = () => {
    const now = useCurrentDefaultTick();
    return (
      <>
        <ActiveRelicEffects entityId={1} relicEffects={getArmyRelicEffects(army, now)} />
        <ActiveRelicEffects entityId={2} relicEffects={getStructureArmyRelicEffects({ troops: army }, now)} />
        <ActiveRelicEffects entityId={3} relicEffects={getStructureRelicEffects(production, now)} />
      </>
    );
  };
  const host = document.createElement("div");
  const root = createRoot(host);
  const damageName = getRelicInfo(ResourcesIds.DamageRelic1)!.name;
  const captions = () => host.querySelectorAll("[title]");
  try {
    act(() =>
      root.render(
        <>
          <BlockTimestampPoller />
          <Effects />
        </>,
      ),
    );
    expect(captions()).toHaveLength(8);
    expect(host.textContent).toContain(`${formatWait(30)} left`);
    army = { ...army, boosts: { ...army.boosts, incr_damage_dealt_end_at: 62 } };
    act(() => useChainTimeStore.getState().setHeartbeat({ timestamp: 61_000 }));
    expect(host.textContent).toContain(damageName);
    act(() => useChainTimeStore.getState().setHeartbeat({ timestamp: 62_000 }));
    expect(host.textContent).not.toContain(damageName);
    expect(captions()).toHaveLength(7);
    act(() => useChainTimeStore.getState().setHeartbeat({ timestamp: 76_000 }));
    expect(captions()).toHaveLength(7);
    expect(host.textContent).toContain(`${formatWait(1)} left`);
    act(() => useChainTimeStore.getState().setHeartbeat({ timestamp: 77_000 }));
    expect(host.textContent).toBe("");
  } finally {
    act(() => root.unmount());
  }
});
