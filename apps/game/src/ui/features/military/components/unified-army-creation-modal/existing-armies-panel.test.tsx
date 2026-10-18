import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configManager, setBlockTimestampSource, setChainProvenTimestampSource } from "@bibliothecadao/eternum";
import { TickIds, type Troops } from "@bibliothecadao/types";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { resolveMovementStamina } from "@/lib/army-stamina/movement-affordability";
import { BlockTimestampPoller } from "@/ui/shared/components/block-timestamp-poller";
import { ExistingArmiesPanel } from "./existing-armies-panel";

const fixture = vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
  return { troops: null as Troops | null, mode: "blitz" };
});
vi.mock("@/hooks/helpers/use-armies", () => ({
  useExplorersByStructure: () => [{ entityId: 9, isMine: true, troops: fixture.troops, position: { x: 0, y: 0 } }],
}));
vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: (select: (state: object) => unknown) =>
    select({ bumpMilitaryMapVersion: () => {}, selectOnMap: () => {}, setLeftNavigationView: () => {} }),
}));
const deleteExplorerArmy = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/sync/active-game-client", () => ({
  requireActiveGameClient: () => ({ actions: { deleteExplorerArmy } }),
}));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useGameModeConfig: () => ({ id: fixture.mode }) }));
vi.mock("@/ui/design-system/molecules/resource-icon", () => ({ ResourceIcon: () => null }));

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
    stamina: { amount: 10n, settled_at: 101, remainder: 0 },
    boosts: {
      incr_damage_dealt_percent_num: 0,
      incr_damage_dealt_end_at: 0,
      decr_damage_gotten_percent_num: 0,
      decr_damage_gotten_end_at: 0,
      incr_stamina_regen_percent_num: 0,
      incr_stamina_regen_seconds_left: 0,
      incr_explore_reward_percent_num: 0,
      incr_explore_reward_end_at: 0,
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

describe("disbanding an army", () => {
  const mount = (mode: string) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    fixture.mode = mode;
    fixture.troops = null;
    deleteExplorerArmy.mockClear();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(<ExistingArmiesPanel structureId={7} />));
    return { host, root };
  };

  it("acts at once in Blitz, where no verb asks twice", async () => {
    const { host, root } = mount("blitz");
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Disband army"]')!.click());
    expect(deleteExplorerArmy).toHaveBeenCalledWith({ structureId: 7, explorerId: 9 });
    expect(host.querySelector('[role="alertdialog"]')).toBeNull();
    act(() => root.unmount());
    host.remove();
  });

  it("asks first in Frontier, where a disbanded army is lost for good", async () => {
    const { host, root } = mount("frontier");
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Disband army"]')!.click());
    expect(deleteExplorerArmy).not.toHaveBeenCalled();
    const dialog = host.querySelector('[role="alertdialog"]')!;
    expect(dialog.getAttribute("aria-label")).toBe("Disband this army?");
    const verb = [...dialog.querySelectorAll("button")].find((button) => button.textContent === "Disband")!;
    await act(async () => verb.click());
    expect(deleteExplorerArmy).toHaveBeenCalledWith({ structureId: 7, explorerId: 9 });
    act(() => root.unmount());
    host.remove();
  });
});
