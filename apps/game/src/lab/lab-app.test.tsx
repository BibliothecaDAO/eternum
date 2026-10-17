import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { LabApp } from "./lab-app";

const lifecycle = vi.hoisted(() => ({ active: new Set<string>(), disposed: [] as string[] }));
function Tool({ name }: { name: string }) {
  const location = useLocation();
  useEffect(() => {
    lifecycle.active.add(name);
    return () => {
      lifecycle.active.delete(name);
      lifecycle.disposed.push(name);
    };
  }, [name]);
  return <canvas aria-label={name} data-address={`${location.pathname}${location.search}`} />;
}
vi.mock("../ui/features/debug/procedural-terrain-debug-view", () => ({
  ProceduralTerrainDebugView: () => <Tool name="terrain" />,
}));
vi.mock("../ui/features/debug/model-lab-view", () => ({ ModelLabView: () => <Tool name="models" /> }));
vi.mock("../ui/features/debug/reward-lab-view", () => ({ RewardLabView: () => <Tool name="rewards" /> }));
vi.mock("../ui/features/debug/terrain-prop-debug-view", () => ({ TerrainPropDebugView: () => <Tool name="props" /> }));
vi.mock("./endgame-mist/view", () => ({ EndgameMistLabView: () => <Tool name="endgame" /> }));
vi.mock("../ui/features/debug/world-fx-gym-view", () => ({ WorldFxGymView: () => <Tool name="fx" /> }));
vi.mock("../ui/features/debug/procedural-character-gym-view", () => ({
  ProceduralCharacterGymView: () => <Tool name="characters" />,
}));
vi.mock("../ui/features/debug/procedural-character-benchmark-view", () => ({
  ProceduralCharacterBenchmarkView: () => <Tool name="benchmark" />,
  ProceduralWorldGymView: () => <Tool name="world" />,
}));
vi.mock("../ui/features/debug/three-chunk-debug-view", () => ({ ThreeChunkDebugView: () => <Tool name="chunks" /> }));
vi.mock("../ui/features/debug/procedural-terrain-benchmark-view", () => ({
  ProceduralTerrainBenchmarkView: () => <Tool name="terrain-benchmark" />,
}));
vi.mock("../ui/features/debug/map-label-lab/map-label-lab-view", () => ({
  MapLabelLabView: () => <Tool name="map-labels" />,
}));
vi.mock("../ui/features/debug/motion-lab/motion-lab-view", () => ({ MotionLabView: () => <Tool name="motion" /> }));
vi.mock("../ui/features/debug/kit-lab/kit-lab-view", () => ({ KitLabView: () => <Tool name="kit" /> }));
vi.mock("../shell/lab/app-lab", () => ({ AppLabView: () => <Tool name="app" /> }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  lifecycle.active.clear();
  lifecycle.disposed.length = 0;
});
async function findTool(name: string) {
  await act(async () => {
    await vi.dynamicImportSettled();
  });
  const canvas = container.querySelector(`canvas[aria-label="${name}"]`);
  expect(canvas).not.toBeNull();
  return canvas!;
}
async function selectTool(path: string) {
  const select = container.querySelector<HTMLSelectElement>('select[aria-label="Lab tool"]')!;
  await act(async () => {
    select.value = path;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function openLab(address: string) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[address]}>
        <Routes>
          <Route path="/lab/*" element={<LabApp />} />
          <Route path="/" element={<p>Home</p>} />
        </Routes>
      </MemoryRouter>,
    ),
  );
}

it.each([
  ["/lab", "terrain"],
  ["/lab/", "terrain"],
  ["/lab/models", "models"],
  ["/lab/rewards", "rewards"],
  ["/lab/terrain-props", "props"],
  ["/lab/world-fx", "fx"],
  ["/lab/endgame?variation=tide&gameMode=frontier", "endgame"],
  ["/lab/characters", "characters"],
  ["/lab/character-benchmark", "benchmark"],
  ["/lab/world", "world"],
  ["/lab/chunks", "chunks"],
  ["/lab/terrain-benchmark", "terrain-benchmark"],
  ["/lab/map-labels?zoom=close&hover=28", "map-labels"],
  ["/lab/motion", "motion"],
  ["/lab/kit/hud/live", "kit"],
  ["/lab/app/home/profile", "app"],
])("opens %s through the common bootstrap", async (address, name) => {
  await openLab(address);
  expect((await findTool(name)).getAttribute("data-address")).toBe(address);
  expect(container.querySelector('select[aria-label="Lab tool"]')).toBeTruthy();
  expect(document.documentElement.dataset.bootState).toBe("app-ready");
  expect(lifecycle.active).toEqual(new Set([name]));
});

it("disposes the old tool, restores its query on return, and releases the viewport on exit", async () => {
  await openLab("/lab/chunks?rendererMode=webgpu-force-webgl");
  await findTool("chunks");
  await selectTool("/lab/models");
  await findTool("models");
  expect(lifecycle.disposed).toContain("chunks");
  expect(lifecycle.active).toEqual(new Set(["models"]));
  await selectTool("/lab/chunks");
  expect((await findTool("chunks")).getAttribute("data-address")).toBe("/lab/chunks?rendererMode=webgpu-force-webgl");
  await act(async () => {
    container.querySelector<HTMLAnchorElement>('a[aria-label="Exit lab to home"]')!.click();
  });
  expect(container.textContent).toBe("Home");
  expect(lifecycle.active.size).toBe(0);
  expect(document.documentElement.classList.contains("scene-viewport")).toBe(false);
});

it("retains full-viewport capture routes without the selector", async () => {
  await openLab("/lab/models?capture=1&model=knight");
  expect((await findTool("models")).getAttribute("data-address")).toBe("/lab/models?capture=1&model=knight");
  expect(container.querySelector("select")).toBeNull();
  expect(document.querySelector('.lab-app[data-capture="true"]')).toBeTruthy();
});
