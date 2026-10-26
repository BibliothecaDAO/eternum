// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@/ui/features/debug/kit-lab/hud-lab", () => ({
  HUD_LAB_STATES: ["idle", "selected", "site-camp", "fight-won", "deploy", "season", "next-up-rest"],
}));
vi.mock("@/ui/features/debug/kit-lab/unified-hud-lab", () => ({
  UNIFIED_VIEWS: [
    { name: "blitz", frontier: false },
    { name: "frontier", frontier: true },
    { name: "frontier-army", frontier: true },
    { name: "blitz-spectator", frontier: false },
  ],
}));
const { HudRoomView } = await import("./view");

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let host: HTMLDivElement;
const Address = () => {
  const location = useLocation();
  return <output data-address={`${location.pathname}${location.search}`} />;
};
beforeEach(() => {
  // A stage 1,600 by 1,000: jsdom lays nothing out.
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1600);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(1000);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const open = async (at: string) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route
            path="/lab/hud"
            element={
              <>
                <HudRoomView />
                <Address />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    ),
  );
};
const frames = () =>
  [...host.querySelectorAll("iframe")].map((frame) => ({ src: frame.getAttribute("src"), width: frame.style.width }));
const groups = () => [...host.querySelectorAll("nav section h2")].map((heading) => heading.textContent);
const press = async (name: string) => {
  const button = [...host.querySelectorAll("nav button")].find((each) => each.textContent === name);
  expect(button, name).toBeDefined();
  await act(async () => (button as HTMLButtonElement).click());
};

it("draws Frontier's HUD as the game mounts it on a desktop and a phone, side by side", async () => {
  await open("/lab/hud?mode=frontier");
  expect(frames()).toEqual([
    { src: "/lab/kit/unified/frontier?capture=1", width: "1440px" },
    { src: "/lab/kit/unified/frontier?capture=1", width: "390px" },
  ]);
  expect(groups()).toEqual([
    "As the game mounts it",
    "Sites & fights",
    "Deploy",
    "Realm & build",
    "Research",
    "Next up",
    "The day",
    "Season & purse",
    "Map & army",
    "Parts",
  ]);
});

it("draws a state the owner picks, and keeps it in the address", async () => {
  await open("/lab/hud?mode=frontier");
  await press("site-camp");
  expect(frames().map((frame) => frame.src)).toEqual([
    "/lab/kit/hud/site-camp?capture=1",
    "/lab/kit/hud/site-camp?capture=1",
  ]);
  expect(host.querySelector("output")!.getAttribute("data-address")).toBe(
    "/lab/hud?mode=frontier&show=state%3Asite-camp",
  );
});

it("draws one device when the Device switch asks for one", async () => {
  await open("/lab/hud?mode=frontier&device=phone&show=state:idle");
  expect(frames()).toEqual([{ src: "/lab/kit/hud/idle?capture=1", width: "390px" }]);
});

it("lists Blitz's HUD and its parts for Blitz, and none of Frontier's states", async () => {
  await open("/lab/hud?mode=blitz");
  expect(frames()[0]!.src).toBe("/lab/kit/unified/blitz?capture=1");
  expect(groups()).toEqual(["As the game mounts it", "Parts"]);
  expect(host.textContent).toContain("blitz-spectator");
  expect(host.textContent).toContain("Build order");
  expect(host.textContent).not.toContain("site-camp");
});
