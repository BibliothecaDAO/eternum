import type { ResourcesIds } from "@bibliothecadao/types";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { plays, flights } = vi.hoisted(() => ({
  plays: [] as Array<{ id: string; detuneCents?: number }>,
  flights: [] as Array<{ to: unknown; onArrive?: (index: number) => void }>,
}));
vi.mock("@/audio/core/AudioManager", () => ({
  AudioManager: {
    getInstance: () => ({
      play: (id: string, options?: { detuneCents?: number }) => {
        plays.push({ id, detuneCents: options?.detuneCents });
        return Promise.resolve(null);
      },
    }),
  },
}));
vi.mock("../motion-layer", () => ({
  flySprites: (flight: { to: unknown; onArrive?: (index: number) => void }) => flights.push(flight),
}));
vi.mock("@/three/sound/utils", () => ({ getResourceSoundId: (id: number) => `collect.${id}` }));

const LABOR = 23;
const ESSENCE = 38;
const TILE = { x: 100, y: 200 };

const load = async () => {
  vi.resetModules();
  return import("./reveal-yield");
};

beforeEach(() => {
  vi.useFakeTimers();
  plays.length = 0;
  flights.length = 0;
  document.body.innerHTML = "";
});
afterEach(() => vi.useRealTimers());

describe("the reveal yield", () => {
  it("climbs a semitone per chained reveal up to seven, and starts over after three idle seconds", async () => {
    const { playRevealYield } = await load();
    for (let reveal = 0; reveal < 10; reveal += 1) {
      playRevealYield({ resourceId: LABOR, from: TILE, now: reveal * 1_000 });
    }
    playRevealYield({ resourceId: LABOR, from: TILE, now: 9_000 + 3_001 });
    expect(plays.map((play) => play.detuneCents)).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 700, 700, 0]);
    expect(plays[0].id).toBe(`collect.${LABOR}`);
  });

  it("merges flights to one counter within a second, but not flights to another counter", async () => {
    const { playRevealYield } = await load();
    playRevealYield({ resourceId: LABOR, from: TILE, now: 0 });
    playRevealYield({ resourceId: LABOR, from: TILE, now: 500 });
    playRevealYield({ resourceId: ESSENCE, from: TILE, now: 600 });
    playRevealYield({ resourceId: LABOR, from: TILE, now: 1_001 });
    expect(flights).toHaveLength(3);
    expect(plays).toHaveLength(4);
  });

  it("keeps at most six sprites in the air", async () => {
    const { playRevealYield } = await load();
    for (let reveal = 0; reveal < 8; reveal += 1) {
      playRevealYield({ resourceId: (100 + reveal) as ResourcesIds, from: TILE, now: reveal });
    }
    expect(flights).toHaveLength(6);
    flights[0].onArrive?.(0);
    playRevealYield({ resourceId: 200 as ResourcesIds, from: TILE, now: 10 });
    expect(flights).toHaveLength(7);
  });

  it("flies to the banked counter and keeps its old number until the icon lands", async () => {
    const { playRevealYield, bankedCounterTarget } = await load();
    const { useLandedValue } = await import("../landing-hold");
    const target = bankedCounterTarget(LABOR);
    const Counter = ({ value }: { value: number }) => (
      <span data-fly-target={target}>{useLandedValue(target, value)}</span>
    );
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<Counter value={1_250} />));

    await act(async () => playRevealYield({ resourceId: LABOR, from: TILE, now: 0 }));
    await act(async () => root.render(<Counter value={1_400} />));
    expect(flights[0].to).toBe(host.firstChild);
    expect(host.textContent).toBe("1250");

    await act(async () => flights[0].onArrive?.(0));
    expect(host.textContent).toBe("1400");
    await act(async () => root.unmount());
  });

  it("rises where it was found when no counter is on screen", async () => {
    const { playRevealYield } = await load();
    playRevealYield({ resourceId: LABOR, from: TILE, now: 0 });
    expect(flights[0].to).toEqual({ x: TILE.x, y: TILE.y - 48 });
  });
});
