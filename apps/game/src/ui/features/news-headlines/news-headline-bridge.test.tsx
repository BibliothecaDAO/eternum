// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

// The season's winner is read from the shard's stories, which this game has none of before it ends.
vi.mock("@/hooks/store/use-story-events-store", async (original) => ({
  ...(await original<typeof import("@/hooks/store/use-story-events-store")>()),
  useSeasonWinner: () => null,
}));

import { GameProvider } from "@/hooks/context/game-context";
import { useBlockTimestampStore } from "@/hooks/store/use-block-timestamp-store";
import { disposeGameSyncSession } from "@/sync/active-game-client";
import { readFactView, seasonClockView } from "@/sync/fact-views";
import { installLabGame } from "@/ui/features/debug/kit-lab/fixture-game";

import { HEADLINE_DISPLAY_MS } from "./headline-types";
import { NewsHeadlineBridge } from "./news-headline-bridge";

afterEach(() => {
  vi.useRealTimers();
  disposeGameSyncSession();
});

it("announces the game's start as it begins, with nothing to press, and lets it go by itself", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const store = installLabGame(2, false);
  const startAt = readFactView(store, seasonClockView).gameStartMainAt!;
  const clockAt = (seconds: number) => act(() => useBlockTimestampStore.setState({ currentBlockTimestamp: seconds }));
  clockAt(startAt - 10);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const news = () => host.querySelector('[role="status"][aria-label="The game has begun"]');
  try {
    await act(async () =>
      root.render(
        <GameProvider value={{ store } as never} account={{ address: "0x111" } as never}>
          <NewsHeadlineBridge />
        </GameProvider>,
      ),
    );
    expect(news()).toBeNull();

    clockAt(startAt + 1);
    expect(news()).not.toBeNull();
    // News is read, never pressed: no close, no link, nothing the player must dismiss to play on.
    expect(host.querySelector("button, a[href]")).toBeNull();

    await act(async () => vi.advanceTimersByTime(HEADLINE_DISPLAY_MS));
    vi.useRealTimers();
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)));
    expect(news()).toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
