import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { expect, it } from "vitest";

import { SCENE_ADDRESS_EVENT } from "./scene-address";
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

it("announces each address the scene shows and its leaving, so a renderer that outlives the route gives the page back", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  let announced = 0;
  const count = () => (announced += 1);
  window.addEventListener(SCENE_ADDRESS_EVENT, count);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/season"]}>
        <Navigator />
        <Routes>
          <Route path="/season" element={<p>season</p>} />
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
    expect(announced).toBe(0);
    // Into the doorway, on to the scene, between scenes: each address is announced once it is the page's.
    await act(async () => navigate("/g/0xa/1"));
    expect(announced).toBe(1);
    await act(async () => navigate("/g/0xa/1/map"));
    await act(async () => navigate("/g/0xa/1/hex"));
    const inside = announced;
    expect(inside).toBeGreaterThanOrEqual(3);
    // Out by the app's own navigation: the frame says it has left.
    await act(async () => navigate("/season"));
    expect(announced).toBe(inside + 1);
    await act(async () => navigate("/g/0xa/1/map"));
    expect(announced).toBe(inside + 2);
  } finally {
    window.removeEventListener(SCENE_ADDRESS_EVENT, count);
    await act(async () => root.unmount());
  }
});
