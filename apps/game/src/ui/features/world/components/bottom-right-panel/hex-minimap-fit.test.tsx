import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { HexMinimap } from "./hex-minimap";

// The minimap's markers and the game's synchronized configuration are not this test's business.
vi.mock("@/hooks/use-fact-view", () => ({ useFactView: () => new Map() }));
vi.mock("@/ui/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/ui/config")>()),
  FELT_CENTER: () => 0,
}));

const wait = (ms: number) => act(async () => void (await new Promise((resolve) => setTimeout(resolve, ms))));

/** The centre of the area an SVG viewBox shows. */
const shownCentre = (svg: SVGSVGElement) => {
  const [minX, minY, width, height] = svg.getAttribute("viewBox")!.split(" ").map(Number);
  return { x: minX + width / 2, y: minY + height / 2 };
};

it("shows the whole explored area once it loads, wherever the camera is and while the view still follows it", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  // An explored cross around the world's centre, with the camera at its east end.
  const explored = [
    ...[-6, -4, -2, 0, 2, 4, 6].map((col) => ({ col, row: 0, biome: 11 })),
    ...[-4, -2, 2, 4].map((row) => ({ col: 0, row, biome: 11 })),
  ];
  const show = (tiles: typeof explored, camera: { col: number; row: number }) =>
    act(async () =>
      root.render(
        <StrictMode>
          <HexMinimap tiles={tiles} selectedHex={null} navigationTarget={null} cameraTargetHex={camera} look="badges" />
        </StrictMode>,
      ),
    );
  try {
    // The tiles load after the minimap mounts, as they do in a game: the view starts following the camera first.
    await show([], { col: 6, row: 0 });
    await wait(30);
    await show(explored, { col: 6, row: 0 });
    await wait(600);
    const svg = host.querySelector("svg")!;
    const fitted = svg.getAttribute("viewBox");
    expect(shownCentre(svg).x).toBeCloseTo(0, 0);
    expect(shownCentre(svg).y).toBeCloseTo(0, 0);

    await show(explored, { col: -6, row: 0 });
    await wait(600);
    expect(svg.getAttribute("viewBox")).toBe(fitted);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
