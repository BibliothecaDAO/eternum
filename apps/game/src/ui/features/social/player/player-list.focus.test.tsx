// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({ ui: { showGuildsTab: false } }),
}));
vi.mock("@/hooks/use-player-avatar", () => ({ getAvatarUrl: () => null }));
vi.mock("../components/register-points-button", () => ({ RegisterPointsButton: () => null }));
vi.mock("./leaderboard-effects", () => ({ LeaderboardEffectsOverlay: () => null }));
vi.mock("./use-leaderboard-effects", async () => {
  const { useRef } = await import("react");
  return { useLeaderboardEffects: () => ({ effects: new Map(), rowRefs: useRef(new Map()) }) };
});
vi.mock("@/ui/utils/utils", () => ({ currencyIntlFormat: String }));
vi.mock("gsap", () => ({ default: { fromTo: vi.fn() } }));
import { PlayerList, type PlayerCustom } from "./player-list";

const player = (address: bigint, isUser = false) =>
  ({
    address,
    isUser,
    name: isUser ? "djizus" : "rival",
    rank: Number(address),
    points: 10,
    structures: [],
    hyperstructures: 0,
    activityBreakdown: null,
  }) as unknown as PlayerCustom;
const container = document.createElement("div");
let root: ReturnType<typeof createRoot>;
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

it("waits for the own row, highlights it and scrolls once without opening a profile", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.append(container);
  root = createRoot(container);
  const scroll = vi.fn();
  Element.prototype.scrollIntoView = scroll;
  const view = vi.fn();
  const render = (players: PlayerCustom[]) =>
    act(() =>
      root.render(
        <PlayerList
          players={players}
          focusOwnPlayer
          viewPlayerInfo={view}
          whitelistPlayer={vi.fn()}
          isLoading={false}
        />,
      ),
    );
  await render([]);
  expect(scroll).not.toHaveBeenCalled();
  await render([player(1n), player(2n, true)]);
  const ownRow = container.querySelector('[data-player-address="2"]');
  expect(ownRow?.getAttribute("aria-current")).toBe("true");
  expect(ownRow?.textContent).toContain("0x2");
  expect(scroll).toHaveBeenCalledOnce();
  expect(scroll).toHaveBeenCalledWith({ block: "center" });
  expect(view).not.toHaveBeenCalled();
  await render([player(1n), player(2n, true)]);
  expect(scroll).toHaveBeenCalledOnce();
});
