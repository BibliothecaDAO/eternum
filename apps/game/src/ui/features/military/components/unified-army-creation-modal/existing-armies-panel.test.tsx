import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { configManager, setBlockTimestampSource, setChainProvenTimestampSource } from "@bibliothecadao/eternum";
import { TickIds, type Troops } from "@bibliothecadao/types";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { resolveMovementStamina } from "@/lib/army-stamina/movement-affordability";
import { BlockTimestampPoller } from "@/ui/shared/components/block-timestamp-poller";
import { ExistingArmiesPanel } from "./existing-armies-panel";

const fixture = vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
  return { troops: null as Troops | null };
});
vi.mock("@/hooks/helpers/use-armies", () => ({
  useExplorersByStructure: () => [{ entityId: 9, isMine: true, troops: fixture.troops, position: { x: 0, y: 0 } }],
}));
vi.mock("@/hooks/store/use-ui-store", () => ({ useUIStore: (select: (state: object) => unknown) => select({}) }));
vi.mock("@/sync/active-game-client", () => ({ requireActiveGameClient: vi.fn() }));
vi.mock("@/ui/design-system/molecules/resource-icon", () => ({ ResourceIcon: () => null }));
vi.mock("@/ui/utils/utils", () => ({ currencyFormat: () => "10" }));

afterEach(() => {
  setBlockTimestampSource(null);
  setChainProvenTimestampSource(null);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("keeps the visible army bar and movement gate fixed until the chain-proven floor advances", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(configManager, "getTick").mockImplementation((id) => (id === TickIds.Default ? 1 : 60));
  vi.spyOn(configManager, "getTroopStaminaRules").mockReturnValue({
    stamina_gain_per_tick: 30,
    stamina_initial: 35,
    stamina_knight_max: 120,
    stamina_paladin_max: 140,
    stamina_crossbowman_max: 100,
  } as never);
  const troops: Troops = {
    category: "Knight",
    tier: "T1",
    count: 10n,
    battle_cooldown_end: 0,
    stamina: { amount: 10n, updated_tick: 101n },
    boosts: {
      incr_damage_dealt_percent_num: 0,
      incr_damage_dealt_end_tick: 0,
      decr_damage_gotten_percent_num: 0,
      decr_damage_gotten_end_tick: 0,
      incr_stamina_regen_percent_num: 0,
      incr_stamina_regen_tick_count: 0,
      incr_explore_reward_percent_num: 0,
      incr_explore_reward_end_tick: 0,
    },
  };
  fixture.troops = troops;
  useChainTimeStore.getState().anchor({ timestamp: 101_000 });
  setBlockTimestampSource(() => useChainTimeStore.getState().getNowSeconds());
  setChainProvenTimestampSource(() => useChainTimeStore.getState().executionFloorMs! / 1_000);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const canMove = () =>
    resolveMovementStamina({
      liveTroops: troops,
      actionPath: [{ staminaCost: 11 }],
      timestamp: useChainTimeStore.getState().executionFloorMs! / 1_000,
    }).canAfford;
  try {
    act(() =>
      root.render(
        <>
          <BlockTimestampPoller />
          <ExistingArmiesPanel structureId={7} />
        </>,
      ),
    );
    expect(host.querySelector('[title="Stamina 10/120"]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(1_000));
    expect(host.querySelector('[title="Stamina 10/120"]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(1_000));
    expect(host.querySelector('[title="Stamina 10/120"]')).not.toBeNull();
    act(() => useChainTimeStore.getState().setHeartbeat({ timestamp: 103_000, preconfirmed: true }));
    expect(host.querySelector('[title="Stamina 10/120"]')).not.toBeNull();
    expect(canMove()).toBe(false);
    act(() => useChainTimeStore.getState().setHeartbeat({ timestamp: 103_000 }));
    expect(host.querySelector('[title="Stamina 11/120"]')).not.toBeNull();
    expect(canMove()).toBe(true);
    expect(troops.stamina.amount).toBe(10n);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
