import { advanceGameEnd, resetGameEnd } from "@/three/effects/endgame/state";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { expect, it, vi } from "vitest";

vi.mock("@/audio/hooks/useAudio", () => ({ useAudio: () => ({ play: () => Promise.resolve() }) }));

import { setActiveGame } from "@/runtime/world/store";
import { GameFinishedPill } from "./game-finished-pill";

const BLITZ = { chainId: "0xa", gameId: 5, presetId: 2, name: "blitz-20261021-1200-1" };
const FRONTIER = { chainId: "0xa", gameId: 1, presetId: 1, name: "frontier" };

/** Another tab of the app on this device: its own copy of the client's modules, sharing this page's storage. */
const enterInAnotherTab = async (game: typeof FRONTIER) => {
  vi.resetModules();
  const otherTab = await import("@/runtime/world/store");
  otherTab.setActiveGame(game);
};

const ResultsProbe = () => <p data-testid="results">{useParams().id}</p>;

const press = async (label: string) => {
  const button = [...document.querySelectorAll("button")].find((element) => element.textContent?.includes(label));
  if (!button) throw new Error(`No button "${label}"`);
  await act(async () => button.click());
};

// Owner, 2026-10-21, after a ranked Blitz with the Frontier season open too: "when the blitz game ends, I wanna click
// go to the results, it sends me to the results not the blitz game results".
it("leads from a finished game to that game's Results page, whatever game another tab entered", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setActiveGame(BLITZ);
  await enterInAnotherTab(FRONTIER);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/g/0xa/5/map"]}>
        <Routes>
          <Route path="/g/:chain/:game/*" element={<GameFinishedPill />} />
          <Route path="/results/:id" element={<ResultsProbe />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  try {
    resetGameEnd();
    advanceGameEnd(5, false, 0);
    advanceGameEnd(5, true, 0.1);
    await press("Game finished");
    await press("See the results");
    expect(document.querySelector('[data-testid="results"]')?.textContent).toBe("0xa-5");
    expect(advanceGameEnd(5, true, 0).finished).toBe(true);
  } finally {
    resetGameEnd();
    await act(async () => root.unmount());
    container.remove();
  }
});
