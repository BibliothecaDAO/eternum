// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { PerspectiveCamera, Vector3 } from "three";
import { afterEach, expect, it, vi } from "vitest";

import type { StudioBridge } from "./bridge";
import { StudioLabView } from "./view";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// The renderer is stubbed to a land that answers but draws nothing; the view, bridge and stage are the real ones.
vi.mock("@/three/debug/procedural-terrain-debug-renderer", () => ({
  mountProceduralTerrainDebugRenderer: async ({ stage }: { stage: { dispose(): void } }) => {
    Object.assign(stage, {
      context: {
        camera: new PerspectiveCamera(),
        controls: { target: new Vector3(), enabled: true },
        terrain: { sampleSurface: () => ({ height: 0 }), present: vi.fn(), cancelShroudReveals: vi.fn() },
      },
      pages: [{}],
    });
    return { dispose: () => stage.dispose(), setClock: vi.fn(), strike: vi.fn() };
  },
}));

let root: Root;
let host: HTMLDivElement;
const studio = () => (window as Window & { __studio?: StudioBridge }).__studio;
const page = () => ({
  ready: host.querySelector("[data-ready]")?.getAttribute("data-ready"),
  take: host.querySelector("[data-take]")?.getAttribute("data-take"),
  status: host.querySelector("[role=status]")?.textContent,
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function openStudio() {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/lab/studio"]}>
        <StudioLabView />
      </MemoryRouter>,
    ),
  );
}

it("starts the new world idle when the World changes mid-take", async () => {
  await openStudio();
  await act(async () => void studio()!.take("battle"));
  expect(page().take).toBe("battle");
  await act(async () => {
    const world = host.querySelector<HTMLSelectElement>('select[aria-label="World"]')!;
    world.value = "frontier";
    world.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(studio()!.status().playing).toBe(false);
  expect(page()).toEqual({ ready: "true", take: "idle", status: "Ready to roll" });
});

it("settles a take silently when the page leaves mid-take, and takes its bridge with it", async () => {
  await openStudio();
  let take: Promise<void> | undefined;
  await act(async () => void (take = studio()!.take("explore")));
  await act(async () => root.unmount());
  await expect(take).resolves.toBeUndefined();
  expect(studio()).toBeUndefined();
  root = createRoot(host);
});
