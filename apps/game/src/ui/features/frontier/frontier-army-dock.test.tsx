import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const { select, support } = vi.hoisted(() => ({ select: vi.fn(), support: vi.fn(() => ({ known: 20 })) }));
vi.mock("@/three/scenes/worldmap-army-select-request", () => ({ requestArmySelection: select }));
vi.mock("@/hooks/helpers/use-query", () => ({ useQuery: () => ({ isMapView: true }) }));
vi.mock("@/hooks/helpers/use-navigate", () => ({ useNavigateToMapView: () => vi.fn() }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentArmiesTick: () => 10,
  useBlockTimestamp: () => ({ currentArmiesTick: 10, armiesTickTimeRemaining: 0 }),
  useNowSeconds: () => 350,
}));
vi.mock("@/utils/explorer-stamina", () => ({ getExplorerStaminaSnapshot: () => null }));
vi.mock("./frontier-muster-stamina", () => ({ useOpenArmySlots: () => [], describeSlotBar: () => "—" }));
vi.mock("./frontier-reveal-yield", () => ({ useRevealYield: () => null, formatRevealYield: () => "—" }));
vi.mock("./frontier-home", () => ({ useExpeditionRules: () => null }));
vi.mock("@bibliothecadao/eternum/troop-stamina", () => ({ resolveExplorerTroops: () => undefined }));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
  liveHomeArmies: () => [{ game_id: 1, explorer_id: 201, troops: { category: "Knight", tier: "T1", count: 0n } }],
  entityMapPosition: () => ({ x: 0, y: 0, alt: false }),
  realmSupportPercent: support,
}));

import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { configManager } from "@bibliothecadao/eternum";
import { type GameClientSetup, NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { FrontierArmyDock } from "./frontier-army-dock";

const realm = { entity_id: 100, owner: 0x111n, base: { troop_max_explorer_count: 3 } } as NativeRows["Structure"];

const renderDockAs = (actor: string) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  vi.spyOn(configManager, "getTroopConfig").mockReturnValue({ troop_limit_config: {} } as never);
  vi.spyOn(configManager, "isGameOver").mockReturnValue(false);
  useAccountStore.setState({ account: { address: actor } as never });
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider
        value={{ store: new NativeFactStore() } as unknown as GameClientSetup}
        account={{ address: actor } as never}
      >
        <FrontierArmyDock realm={realm} />
      </GameProvider>,
    ),
  );
  return { host, unmount: () => act(() => root.unmount()) };
};

describe("the army dock", () => {
  it("makes only the actor's own armies pan targets", () => {
    const own = renderDockAs("0x111");
    act(() => own.host.querySelector<HTMLButtonElement>('button[aria-label="Army 1"]')!.click());
    expect(select).toHaveBeenCalledWith(201);
    expect(own.host.querySelector('[aria-label="Support today +20%"]')).not.toBeNull();
    own.unmount();

    // A visited realm's armies show their cards, but none of them moves the camera.
    const visited = renderDockAs("0x222");
    expect(visited.host.querySelector('[role="group"][aria-label="Army 1"]')).not.toBeNull();
    expect(visited.host.querySelector('button[aria-label="Army 1"]')).toBeNull();
    visited.unmount();
  });

  it('shows the realm\'s Support today only on a day that earned it, and "—" while unknown', () => {
    support.mockReturnValueOnce({ known: 0 } as never);
    const quiet = renderDockAs("0x111");
    expect(quiet.host.querySelector('[aria-label^="Support today"]')).toBeNull();
    quiet.unmount();
    support.mockReturnValueOnce({ unknown: "INCOMPLETE_SNAPSHOT" } as never);
    const unknown = renderDockAs("0x111");
    expect(unknown.host.querySelector('[aria-label="Support today —"]')).not.toBeNull();
    unknown.unmount();
  });
});
