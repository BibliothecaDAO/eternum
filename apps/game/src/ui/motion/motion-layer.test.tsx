import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

type Keyframes = { x: number[]; y: number[]; opacity: number[]; scale: number[] };
const { played } = vi.hoisted(() => ({ played: [] as Array<{ sprite: HTMLElement; keyframes: Keyframes }> }));
vi.mock("framer-motion", () => ({
  animate: (sprite: HTMLElement, keyframes: Keyframes) => {
    played.push({ sprite, keyframes });
    return Promise.resolve();
  },
}));

const { MotionLayer, riseSprite } = await import("./motion-layer");
const { useWorldAppearanceStore } = await import("@/hooks/store/use-world-appearance-store");

const TILE = { x: 300, y: 200 };
let unmount = () => {};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  played.length = 0;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<MotionLayer />));
  unmount = () => {
    act(() => root.unmount());
    host.remove();
  };
});
afterEach(() => unmount());

it("pops a reveal's amount on its tile and lifts it 48 px as it fades", () => {
  useWorldAppearanceStore.setState({ reducedMotion: false });
  riseSprite({ at: TILE, icon: "/labor.png", label: "+91" });
  const [{ sprite, keyframes }] = played;
  expect(sprite.textContent).toBe("+91");
  expect(keyframes.y).toEqual([189, 189, 141]);
  expect(keyframes.opacity).toEqual([0, 1, 0]);
});

it("under Reduced motion shows the amount where it was found, then lets it go without moving", () => {
  useWorldAppearanceStore.setState({ reducedMotion: true });
  riseSprite({ at: TILE, icon: "/labor.png", label: "+91" });
  const [{ sprite, keyframes }] = played;
  expect(sprite.textContent).toBe("+91");
  expect(keyframes.x).toEqual([289, 289, 289]);
  expect(keyframes.y).toEqual([189, 189, 189]);
  expect(keyframes.scale).toEqual([1, 1, 1]);
  expect(keyframes.opacity).toEqual([1, 1, 0]);
});
