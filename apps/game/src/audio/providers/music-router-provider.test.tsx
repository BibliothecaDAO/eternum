import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const play = vi.fn(async () => ({ stop: () => {} }) as unknown as AudioBufferSourceNode);

vi.mock("../hooks/useAudio", () => ({
  useAudio: () => ({
    ensureReady: async () => true,
    play,
    audioState: { muted: false },
    isReady: true,
    fadeOutAndStopMusic: async () => {},
  }),
}));

// The page-wide flag starts unset in each case, as on a fresh visit.
const fresh = async () => {
  vi.resetModules();
  const { MusicRouterProvider } = await import("./music-router-provider");
  const { markWorldInteractive } = await import("@/game-entry/world-interactive");
  return { MusicRouterProvider, markWorldInteractive };
};

const mount = async (node: React.ReactNode) => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<MemoryRouter initialEntries={["/"]}>{node}</MemoryRouter>));
  return () => act(async () => root.unmount());
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  play.mockClear();
});

afterEach(() => document.body.replaceChildren());

it("plays the app's playlist as soon as the player turns music on, before any world has loaded", async () => {
  const { MusicRouterProvider } = await fresh();
  const unmount = await mount(<MusicRouterProvider>{null}</MusicRouterProvider>);
  expect(play).toHaveBeenCalledTimes(1);
  await unmount();
});

it("holds a game's music while its world loads, and starts it with the first view", async () => {
  const { MusicRouterProvider, markWorldInteractive } = await fresh();
  const unmount = await mount(
    <MusicRouterProvider modeId="frontier" waitsForWorld>
      {null}
    </MusicRouterProvider>,
  );
  expect(play).not.toHaveBeenCalled();
  await act(async () => markWorldInteractive());
  expect(play).toHaveBeenCalledTimes(1);
  await unmount();
});
