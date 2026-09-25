import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { goTo } = vi.hoisted(() => ({ goTo: vi.fn() }));
vi.mock("@/hooks/helpers/use-navigate", () => ({ useGoToStructure: () => goTo }));
vi.mock("@/hooks/use-player-profile", () => ({ usePlayerDisplayName: () => "Rival" }));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
  structureMapPosition: () => ({ x: 4, y: 5, alt: false }),
}));

import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { disposeGameSyncSession, installActiveGameClient, startRealmVisit } from "@/sync/active-game-client";
import { configManager, type GameClient } from "@bibliothecadao/eternum";
import { type GameClientSetup, NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { RealmVisitBanner } from "./realm-visit-banner";

const realmRow = (entityId: number, owner: string) => ({
  model: "Structure",
  key: `0x${entityId.toString(16)}`,
  value: {
    game_id: 1,
    entity_id: entityId,
    owner,
    base: {
      category: 1,
      level: 0,
      created_at: "0x1",
      troop_max_guard_count: 0,
      troop_max_explorer_count: 0,
      starting_troops_granted: false,
    },
    resources_packed: "0x0",
    metadata: {
      realm_id: entityId,
      village_realm: 0,
      mine_kind: 0,
      deepest_depth: 0,
      has_wonder: false,
      order: 0,
    },
  },
});

let host: HTMLDivElement;
let root: Root;
let store: NativeFactStore;
const visit = vi.fn();

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  store = new NativeFactStore();
  store.applyFacts([realmRow(7, "0x111")] as never);
  useAccountStore.setState({ account: { address: "0x111" } as never });
  installActiveGameClient({ connect: vi.fn(), disconnect: vi.fn(), dispose: vi.fn(), visit } as unknown as GameClient);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  goTo.mockClear();
  visit.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  disposeGameSyncSession();
  vi.restoreAllMocks();
});

const renderBanner = () =>
  act(() =>
    root.render(
      <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
        <RealmVisitBanner home={store.get("Structure", { game_id: 1, entity_id: 7 })!} />
      </GameProvider>,
    ),
  );

describe("a realm visit", () => {
  it("streams the visited realm, opens it as a spectator once it arrives, and leaves for home whole", () => {
    renderBanner();
    expect(host.textContent).toBe("");

    act(() => startRealmVisit({ player: "0x222", structureId: 8 }));
    expect(visit).toHaveBeenLastCalledWith("0x222");
    const banner = () => host.querySelector('[role="status"]')!;
    expect(banner().getAttribute("aria-label")).toBe("Visiting Rival's realm");
    // Until its rows arrive the name pulses and the realm stays closed.
    expect(banner().querySelector(".animate-pulse")?.textContent).toBe("Rival");
    expect(goTo).not.toHaveBeenCalled();

    // Herald's visit scope brings the realm in: it opens once, read-only.
    act(() => store.applyFacts([realmRow(8, "0x222")] as never));
    expect(goTo).toHaveBeenCalledOnce();
    expect(goTo).toHaveBeenLastCalledWith(8, expect.anything(), false, { spectator: true });
    expect(banner().querySelector(".animate-pulse")).toBeNull();

    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Leave")!.click());
    expect(visit).toHaveBeenLastCalledWith(null);
    expect(goTo).toHaveBeenLastCalledWith(7, expect.anything(), false, { spectator: false });
    expect(host.textContent).toBe("");
  });

  it("ends with the account that started it", () => {
    renderBanner();
    act(() => startRealmVisit({ player: "0x222", structureId: 8 }));
    act(() => useAccountStore.setState({ account: { address: "0x333" } as never }));
    expect(host.textContent).toBe("");
  });
});
