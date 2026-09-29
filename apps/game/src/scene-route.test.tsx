import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { expect, it } from "vitest";

import { SCENE_VIEWPORT_CLASS, SceneRoute } from "./scene-route";

let navigate: ReturnType<typeof useNavigate> = () => undefined;
const Navigator = () => {
  navigate = useNavigate();
  return null;
};

it("a shell page scrolls again after entering and leaving a game", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  const locked = () => document.documentElement.classList.contains(SCENE_VIEWPORT_CLASS);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/account"]}>
        <Navigator />
        <Routes>
          <Route path="/account" element={<p>account</p>} />
          <Route
            path="/g/:chain/:game/*"
            element={
              <SceneRoute fallback={null}>
                <canvas />
              </SceneRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    ),
  );
  try {
    expect(locked()).toBe(false);
    await act(async () => navigate("/g/0xa/1/map"));
    expect(locked()).toBe(true);
    await act(async () => navigate("/account"));
    expect(locked()).toBe(false);
  } finally {
    await act(async () => root.unmount());
  }
});
