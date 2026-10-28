import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { LabApp } from "./lab-app";
import { ROOMS } from "./rooms";

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
vi.mock("./relic-chest/view", () => ({ RelicChestLab: () => <Tool name="relic-chest" /> }));
vi.mock("../ui/features/debug/terrain-prop-debug-view", () => ({ TerrainPropDebugView: () => <Tool name="props" /> }));
vi.mock("./endgame-mist/view", () => ({ EndgameMistLabView: () => <Tool name="endgame" /> }));
vi.mock("./day-end/view", () => ({ DayEndLabView: () => <Tool name="day-end" /> }));
vi.mock("../ui/features/debug/world-fx-gym-view", () => ({ WorldFxGymView: () => <Tool name="fx" /> }));
vi.mock("./studio/view", () => ({ StudioLabView: () => <Tool name="studio" /> }));
vi.mock("../ui/features/debug/procedural-character-gym-view", () => ({
  ProceduralCharacterGymView: () => <Tool name="characters" />,
}));
vi.mock("../ui/features/debug/three-chunk-debug-view", () => ({ ThreeChunkDebugView: () => <Tool name="chunks" /> }));
vi.mock("../ui/features/debug/procedural-terrain-benchmark-view", () => ({
  ProceduralTerrainBenchmarkView: () => <Tool name="terrain-benchmark" />,
}));
vi.mock("../ui/features/debug/map-label-lab/map-label-lab-view", () => ({
  MapLabelLabView: () => <Tool name="map-labels" />,
}));
vi.mock("../ui/features/debug/motion-lab/motion-lab-view", () => ({ MotionLabView: () => <Tool name="motion" /> }));
vi.mock("../shell/lab/app-lab", () => ({ AppLabView: () => <Tool name="app" /> }));
vi.mock("./game/game-lab-view", () => ({ GameLabView: () => <Tool name="game" /> }));
// The HUD room as the owner uses it here: its comparison, and the link that opens the shown HUD alone.
vi.mock("./hud/view", () => ({
  HudRoomView: () => (
    <>
      <Tool name="hud" />
      <Link to="/lab/kit/unified/frontier">open alone</Link>
    </>
  ),
}));
vi.mock("./data/view", () => ({ DataRoomView: () => <Tool name="data" /> }));
vi.mock("./data/ui-usage", () => ({ UiUsageView: () => <Tool name="ui-usage" /> }));
vi.mock("./kit-sheet/view", () => ({ FrontierSheetView: () => <Tool name="frontier-sheet" /> }));
vi.mock("../ui/features/debug/procedural-character-benchmark-view", () => ({
  ProceduralCharacterBenchmarkView: () => <Tool name="benchmark" />,
  ProceduralWorldGymView: () => <Tool name="world" />,
}));
vi.mock("../ui/features/debug/kit-lab/style-sheet-lab", () => ({
  StyleSheetLab: () => <Tool name="kit-style-sheet" />,
}));
vi.mock("../ui/features/debug/kit-lab/tokens-lab", () => ({ TokensLab: () => <Tool name="kit-tokens" /> }));
vi.mock("../ui/features/debug/kit-lab/app-lab/app-sheet-lab", () => ({
  AppSheetLab: () => <Tool name="kit-app-sheet" />,
}));
vi.mock("../ui/features/debug/kit-lab/shell-kit-lab", () => ({ ShellKitLab: () => <Tool name="kit-shell-kit" /> }));
vi.mock("../ui/features/debug/kit-lab/app-art-lab", () => ({ AppArtLab: () => <Tool name="kit-app-art" /> }));
vi.mock("../ui/features/debug/kit-lab/icon-lab", () => ({ IconLab: () => <Tool name="kit-icon" /> }));
vi.mock("../ui/features/debug/kit-lab/resource-icons-lab", () => ({
  ResourceIconsLab: () => <Tool name="kit-resource-icons" />,
}));
vi.mock("../ui/features/debug/kit-lab/reward-chests-lab", () => ({
  RewardChestsLab: () => <Tool name="kit-reward-chests" />,
}));
vi.mock("../ui/features/debug/kit-lab/beast-icons-lab", () => ({
  BeastIconsLab: () => <Tool name="kit-beast-icons" />,
}));
vi.mock("../ui/features/debug/kit-lab/words-lab", () => ({ WordsLab: () => <Tool name="kit-words" /> }));
vi.mock("../ui/features/debug/kit-lab/hud-lab", () => ({ HudLab: () => <Tool name="kit-hud" /> }));
vi.mock("../ui/features/debug/kit-lab/unified-hud-lab", () => ({
  UnifiedHudLab: () => <Tool name="kit-unified-hud" />,
}));
vi.mock("../ui/features/debug/kit-lab/panels-lab", () => ({ PanelsLab: () => <Tool name="kit-panels" /> }));
vi.mock("../ui/features/debug/kit-lab/guidance-lab", () => ({ GuidanceLab: () => <Tool name="kit-guidance" /> }));
vi.mock("../ui/features/debug/kit-lab/build-order-lab", () => ({
  BuildOrderLab: () => <Tool name="kit-build-order" />,
}));
vi.mock("../ui/features/debug/kit-lab/blitz-build-lab", () => ({
  BlitzBuildLab: () => <Tool name="kit-blitz-build" />,
}));
vi.mock("../ui/features/debug/kit-lab/progression/progression-lab", () => ({
  ProgressionLab: () => <Tool name="kit-progression" />,
}));
vi.mock("../ui/features/debug/kit-lab/windows-lab", () => ({ WindowsLab: () => <Tool name="kit-windows" /> }));
vi.mock("../ui/features/debug/kit-lab/area-d-lab", () => ({ AreaDLab: () => <Tool name="kit-area-d" /> }));
vi.mock("../ui/features/debug/kit-lab/deploy-lab", () => ({ DeployLab: () => <Tool name="kit-deploy" /> }));
vi.mock("../ui/features/debug/kit-lab/chat-lab", () => ({ ChatLab: () => <Tool name="kit-chat" /> }));
vi.mock("../ui/features/debug/kit-lab/construction-lab", () => ({
  ConstructionLab: () => <Tool name="kit-construction" />,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  lifecycle.active.clear();
  lifecycle.disposed.length = 0;
});
async function settle() {
  await act(async () => {
    await vi.dynamicImportSettled();
  });
}
async function findTool(name: string) {
  await settle();
  const canvas = container.querySelector(`canvas[aria-label="${name}"]`);
  expect(canvas, name).not.toBeNull();
  return canvas!;
}
const address = () => container.querySelector("canvas")?.getAttribute("data-address");
const labels = (nav: string) =>
  [...container.querySelectorAll(`[aria-label="${nav}"] > *`)].map((each) => each.textContent);
const current = (nav: string) => container.querySelector(`nav[aria-label="${nav}"] [aria-current="page"]`)?.textContent;
async function press(within: string, name: string) {
  const control = [...container.querySelectorAll<HTMLElement>(`[aria-label="${within}"] > *`)].find(
    (each) => each.textContent === name,
  );
  expect(control, `${within} → ${name}`).toBeDefined();
  await act(async () => control!.click());
  await settle();
}

async function openLab(at: string) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/lab/*" element={<LabApp />} />
          <Route path="/" element={<p>Home</p>} />
        </Routes>
      </MemoryRouter>,
    ),
  );
}

it.each([
  ["/lab/kit", "kit-style-sheet", "Kit", "HUD sheet"],
  ["/lab/kit/tokens", "kit-tokens", "Kit", "HUD sheet"],
  ["/lab/kit/shell", "kit-shell-kit", "Kit", "App sheet"],
  ["/lab/kit/reward-chests", "kit-reward-chests", "Kit", "Icons"],
  ["/lab/kit/beast-icons", "kit-beast-icons", "Kit", "Icons"],
  ["/lab/motion", "motion", "Kit", "Motion"],
  ["/lab/hud?mode=blitz&show=view:blitz", "hud", "HUD", "In game"],
  ["/lab/kit/hud/live", "kit-hud", "HUD", "In game"],
  ["/lab/kit/unified/blitz-attack", "kit-unified-hud", "HUD", "In game"],
  ["/lab/kit/windows/settings", "kit-windows", "HUD", "In game"],
  ["/lab/app/home/profile", "app", "HUD", "App pages"],
  ["/lab/day-end?case=late-block", "day-end", "Game", "Day end"],
  ["/lab/endgame?variation=tide&mode=frontier", "endgame", "Game", "Game end"],
  ["/lab/map-labels?zoom=close&hover=28", "map-labels", "Game", "Map labels & sites"],
  ["/lab/terrain?mode=frontier", "terrain", "Art", "Terrain"],
  ["/lab/terrain-props", "props", "Art", "Terrain"],
  ["/lab/rewards", "rewards", "Art", "Chests"],
  ["/lab/chunks", "chunks", "Art", "Bench"],
  ["/lab/data?view=balance", "data", "Data", "Balance & data"],
  ["/lab/data/usage?mode=blitz", "ui-usage", "Data", "UI usage"],
  ["/lab/kit/frontier-sheet", "frontier-sheet", "Kit", "Frontier sheet"],
  ["/lab/studio?take=battle&mode=frontier", "studio", "Studio", "Set"],
])("opens %s through the common bootstrap, in its room and page", async (at, name, room, page) => {
  await openLab(at);
  expect((await findTool(name)).getAttribute("data-address")).toBe(at);
  expect(document.documentElement.dataset.bootState).toBe("app-ready");
  expect(lifecycle.active).toEqual(new Set([name]));
  expect(current("Rooms")).toBe(room);
  expect(current("Pages")).toBe(page);
});

it("lists the six rooms, and each room its pages", async () => {
  await openLab("/lab/kit");
  await settle();
  expect(labels("Rooms")).toEqual(["Kit", "HUD", "Game", "Art", "Data", "Studio"]);
  expect(labels("Pages")).toEqual(["HUD sheet", "Frontier sheet", "App sheet", "Icons", "Words", "Motion"]);
  expect(labels("Views")).toEqual(["Sheet", "Tokens"]);
  await press("Rooms", "Art");
  expect(labels("Pages")).toEqual(ROOMS.find((room) => room.title === "Art")!.pages.map((page) => page.title));
});

it("opens the lab on what's open, each a link to its page, and returns there from any room", async () => {
  const served: Record<string, unknown> = {
    "/picks/index.json": [{ name: "xp-ladder", title: "XP ladder", page: "/picks/xp-ladder/" }],
    "/ship/index.json": [{ pr: 5102, title: "Devcon season", page: "/ship/5102/" }],
  };
  vi.stubGlobal("fetch", async (address: string) => new Response(JSON.stringify(served[address] ?? null)));
  try {
    await openLab("/lab");
    await settle();
    const links = () =>
      [...container.querySelectorAll<HTMLAnchorElement>(".lab-open a")].map((link) => [
        link.textContent,
        link.getAttribute("href"),
      ]);
    expect(links()).toEqual([
      ["XP ladder", "/picks/xp-ladder/index.html"],
      ["PR #5102: Devcon season", "/ship/5102/index.html"],
    ]);
    // No page is open, so no renderer runs.
    expect(lifecycle.active.size).toBe(0);
    await press("Rooms", "Art");
    await findTool("terrain");
    await act(async () =>
      [...container.querySelectorAll("a")].find((link) => link.textContent === "Open now")!.click(),
    );
    await settle();
    expect(links()).toHaveLength(2);
    expect(lifecycle.active.size).toBe(0);
  } finally {
    vi.unstubAllGlobals();
  }
});

it("says so when nothing is open", async () => {
  vi.stubGlobal("fetch", async () => new Response("[]"));
  try {
    await openLab("/lab");
    await settle();
    expect(container.querySelector(".lab-open")!.textContent).toBe("Open nowNothing open.");
  } finally {
    vi.unstubAllGlobals();
  }
});

it("opens a page that draws Frontier on Frontier, and its Game switch opens it again in the other game", async () => {
  await openLab("/lab/kit");
  await press("Rooms", "Studio");
  expect(address()).toBe("/lab/studio?mode=frontier");
  await press("Game", "Blitz");
  expect(address()).toBe("/lab/studio?mode=blitz");
  expect(lifecycle.disposed).toContain("studio");
  expect(lifecycle.active).toEqual(new Set(["studio"]));
});

it("shows on the Game switch the game a page draws when its address names none", async () => {
  await openLab("/lab/hud");
  await settle();
  expect(labels("Game")).toEqual(["Blitz", "Frontier"]);
  expect(container.querySelector('[aria-label="Game"] [aria-pressed="true"]')?.textContent).toBe("Frontier");
});

it("offers the Device switch only on a page drawn for several devices", async () => {
  await openLab("/lab/kit/words");
  await settle();
  expect(container.querySelector('[aria-label="Device"]')).toBeNull();
  await press("Rooms", "HUD");
  expect(labels("Device")).toEqual(["Both", "Desktop", "Phone"]);
  await press("Device", "Phone");
  expect(address()).toBe("/lab/hud?mode=frontier&device=phone");
});

it("returns from a HUD opened alone to the comparison, its header offering only the way back", async () => {
  await openLab("/lab/kit");
  await press("Rooms", "HUD");
  expect(address()).toBe("/lab/hud?mode=frontier");
  await act(async () =>
    [...container.querySelectorAll("a")].find((link) => link.textContent === "open alone")!.click(),
  );
  await settle();
  expect(address()).toBe("/lab/kit/unified/frontier");
  expect(container.querySelector('[aria-label="Game"]')).toBeNull();
  expect(container.querySelector('[aria-label="Device"]')).toBeNull();
  await press("Views", "← Back to In game");
  expect(address()).toBe("/lab/hud?mode=frontier");
  await press("Rooms", "Kit");
  await press("Rooms", "HUD");
  expect(address()).toBe("/lab/hud?mode=frontier");
  await press("Game", "Blitz");
  expect(address()).toBe("/lab/hud?mode=blitz");
  expect(container.querySelector('[aria-label="Game"] [aria-pressed="true"]')?.textContent).toBe("Blitz");
});

it("keeps the game and the Phone choice across the sheet's views", async () => {
  await openLab("/lab/kit?mode=frontier&device=phone");
  await findTool("kit-style-sheet");
  await press("Views", "Tokens");
  expect(address()).toBe("/lab/kit/tokens?mode=frontier&device=phone");
  await press("Views", "Sheet");
  expect(address()).toBe("/lab/kit?mode=frontier&device=phone");
  expect(container.querySelector('[aria-label="Device"] [aria-pressed="true"]')?.textContent).toBe("Phone");
});

it("disposes the old page, restores where it was left on return, and releases the viewport on exit", async () => {
  await openLab("/lab/chunks?rendererMode=webgpu-force-webgl");
  await findTool("chunks");
  await press("Pages", "Models");
  await findTool("models");
  expect(lifecycle.disposed).toContain("chunks");
  expect(lifecycle.active).toEqual(new Set(["models"]));
  await press("Pages", "Bench");
  expect(address()).toBe("/lab/chunks?rendererMode=webgpu-force-webgl");
  await act(async () => {
    container.querySelector<HTMLAnchorElement>('a[aria-label="Exit lab to home"]')!.click();
  });
  expect(container.textContent).toBe("Home");
  expect(lifecycle.active.size).toBe(0);
  expect(document.documentElement.classList.contains("scene-viewport")).toBe(false);
});

it("keeps capture routes full-viewport, without the header", async () => {
  await openLab("/lab/models?capture=1&model=knight");
  expect((await findTool("models")).getAttribute("data-address")).toBe("/lab/models?capture=1&model=knight");
  expect(container.querySelector("header")).toBeNull();
  expect(document.querySelector('.lab-app[data-capture="true"]')).toBeTruthy();
});
