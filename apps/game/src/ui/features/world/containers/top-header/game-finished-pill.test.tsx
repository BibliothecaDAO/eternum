import { advanceGameEnd, resetGameEnd } from "@/three/effects/endgame/state";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { expect, it, vi } from "vitest";

vi.mock("@/runtime/world/store", () => ({ requireActiveGame: () => ({ chainId: "0xa", gameId: 5 }) }));
vi.mock("@/audio/hooks/useAudio", () => ({ useAudio: () => ({ play: () => Promise.resolve() }) }));

import { GameFinishedPill } from "./game-finished-pill";

const ResultsProbe = () => <p data-testid="results">{useParams().id}</p>;

const press = async (label: string) => {
  const button = [...document.querySelectorAll("button")].find((element) => element.textContent?.includes(label));
  if (!button) throw new Error(`No button "${label}"`);
  await act(async () => button.click());
};

it("leads from a finished game to that game's Results page", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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
