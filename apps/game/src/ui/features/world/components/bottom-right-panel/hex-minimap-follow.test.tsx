import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { FELT_CENTER } from "@/ui/config";

import { HexMinimap } from "./hex-minimap";

// The minimap's markers and the game's synchronized configuration are not this test's business.
vi.mock("@/hooks/use-fact-view", () => ({ useFactView: () => new Map() }));
vi.mock("@/ui/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/ui/config")>()),
  FELT_CENTER: () => 0,
}));

const centre = () => ({ col: FELT_CENTER(), row: FELT_CENTER() });
const settle = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 250))));

it("keeps a dragged minimap view when its parent republishes the same camera hex, and follows a new one", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const tiles = [{ col: FELT_CENTER(), row: FELT_CENTER(), biome: 11 }];
  // Each render hands the minimap a new camera object, as its parent does on every store update.
  const show = async (cameraTargetHex: { col: number; row: number }) => {
    await act(async () =>
      root.render(
        <HexMinimap tiles={tiles} selectedHex={null} navigationTarget={null} cameraTargetHex={cameraTargetHex} />,
      ),
    );
    await settle();
  };
  try {
    await show(centre());
    const svg = host.querySelector("svg")!;
    svg.setPointerCapture = () => {};
    svg.releasePointerCapture = () => {};
    const before = svg.getAttribute("viewBox");
    await act(async () => {
      for (const [type, x, y] of [
        ["pointerdown", 50, 50],
        ["pointermove", 90, 70],
        ["pointerup", 90, 70],
      ] as const) {
        const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
        Object.defineProperty(event, "pointerId", { value: 1 });
        svg.dispatchEvent(event);
      }
    });
    await settle();
    const dragged = svg.getAttribute("viewBox");
    expect(dragged).not.toBe(before);

    await show(centre());
    expect(svg.getAttribute("viewBox")).toBe(dragged);

    await show({ col: FELT_CENTER() + 4, row: FELT_CENTER() });
    expect(svg.getAttribute("viewBox")).not.toBe(dragged);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
