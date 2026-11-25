import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  entry: null as {
    mode: "frontier";
    status: "Created" | "Registration" | "Live" | "Ended" | "Settled";
    clock: { start_settling_at: number; start_main_at: number; scheduled_end_at: number; end_at: number };
    player_state: null;
  } | null,
}));

vi.mock("@/hooks/context/identity-session", () => ({ useIdentitySession: () => ({ status: "anonymous" }) }));
vi.mock("@/hooks/use-game-entry", () => ({ useGameEntry: () => ({ data: state.entry }) }));
vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: (selector: (s: { account: null }) => unknown) => selector({ account: null }),
}));
vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: (selector: (s: { structureEntityId: null; isSpectating: boolean }) => unknown) =>
    selector({ structureEntityId: null, isSpectating: false }),
}));
vi.mock("@/ui/debug/boot-debug-panel", () => ({ BootDebugPanel: () => null }));

import { PlayRouteDoorway } from "./play-route-doorway";
import { DOORWAY_WORDS } from "../../../design-system/kit/words";

afterEach(() => {
  state.entry = null;
});

it("shows the waiting screen with Back to Play when /g/... opens a not-started game, and shows loading once Live", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const startsAt = Math.floor(Date.now() / 1000) + 3 * 3600;
  state.entry = {
    mode: "frontier",
    status: "Registration",
    clock: {
      start_settling_at: startsAt,
      start_main_at: startsAt,
      scheduled_end_at: startsAt + 86_400,
      end_at: startsAt + 86_400,
    },
    player_state: null,
  };
  const container = document.createElement("div");
  const root = createRoot(container);
  const renderDoorway = () =>
    act(async () =>
      root.render(
        <MemoryRouter initialEntries={["/g/0xa/4/map"]}>
          <Routes>
            <Route
              path="/g/:chain/:game/map"
              element={
                <PlayRouteDoorway
                  phase="select_world"
                  audience="player"
                  setup={null}
                  accountError={null}
                  ended={false}
                  refused={undefined}
                  retry={() => {}}
                  currentTaskLabel=""
                />
              }
            />
            <Route path="/" element={<p data-play-home>Play home</p>} />
          </Routes>
        </MemoryRouter>,
      ),
    );
  try {
    await renderDoorway();
    expect(container.textContent).toContain(DOORWAY_WORDS.notStarted);
    expect(container.textContent).toContain("Starts ");
    expect(container.textContent).not.toContain(DOORWAY_WORDS.realm);
    expect(container.textContent).not.toContain("Step 2 of 4");
    expect(container.querySelector('[role="progressbar"]')).toBeNull();

    state.entry = { ...state.entry, status: "Live" };
    await renderDoorway();
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(container.textContent).not.toContain(DOORWAY_WORDS.notStarted);

    state.entry = { ...state.entry, status: "Registration" };
    await renderDoorway();
    const back = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === DOORWAY_WORDS.backToPlay,
    )!;
    await act(async () => back.click());
    expect(container.querySelector("[data-play-home]")?.textContent).toBe("Play home");
  } finally {
    await act(async () => root.unmount());
  }
});
