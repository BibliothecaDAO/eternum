import type { ResourcesIds } from "@bibliothecadao/types";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { plays, flights, rises } = vi.hoisted(() => ({
  plays: [] as Array<{ id: string; detuneCents?: number }>,
  flights: [] as Array<{ to: unknown; onArrive?: (index: number) => void }>,
  rises: [] as Array<{ at: unknown; label: string }>,
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
  riseSprite: (rise: { at: unknown; label: string }) => rises.push(rise),
}));
vi.mock("@/three/sound/utils", () => ({ getResourceSoundId: (id: number) => `collect.${id}` }));

import { bankedCounterTarget } from "./banked-flight";

const LABOR = 23;
const ESSENCE = 38;
const TILE = { x: 100, y: 200 };

const mountCounter = (target: string) => {
  const counter = document.createElement("span");
  counter.dataset.flyTarget = target;
  document.body.append(counter);
  return counter;
};

const load = async () => {
  vi.resetModules();
  return import("./reveal-yield");
};

beforeEach(() => {
  vi.useFakeTimers();
  plays.length = 0;
  flights.length = 0;
  rises.length = 0;
  document.body.innerHTML = "";
});
afterEach(() => vi.useRealTimers());

describe("the reveal yield", () => {
  it("climbs a semitone per chained reveal up to seven, and starts over after three idle seconds", async () => {
    const { playRevealYield } = await load();
    for (let reveal = 0; reveal < 10; reveal += 1) {
      playRevealYield({ own: true, amount: 150, resourceId: LABOR, from: TILE, now: reveal * 1_000 });
    }
    playRevealYield({ own: true, amount: 150, resourceId: LABOR, from: TILE, now: 9_000 + 3_001 });
    expect(plays.map((play) => play.detuneCents)).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 700, 700, 0]);
    expect(plays[0].id).toBe(`collect.${LABOR}`);
  });

  it("merges flights to one counter within a second, but not flights to another counter", async () => {
    const { playRevealYield } = await load();
    mountCounter(bankedCounterTarget(LABOR));
    mountCounter(bankedCounterTarget(ESSENCE));
    playRevealYield({ own: true, amount: 150, resourceId: LABOR, from: TILE, now: 0 });
    playRevealYield({ own: true, amount: 150, resourceId: LABOR, from: TILE, now: 500 });
    playRevealYield({ own: true, amount: 150, resourceId: ESSENCE, from: TILE, now: 600 });
    playRevealYield({ own: true, amount: 150, resourceId: LABOR, from: TILE, now: 1_001 });
    expect(flights).toHaveLength(3);
    expect(plays).toHaveLength(4);
  });

  it("keeps at most six sprites in the air", async () => {
    const { playRevealYield } = await load();
    for (const id of [100, 101, 102, 103, 104, 105, 106, 107, 200])
      mountCounter(bankedCounterTarget(id as ResourcesIds));
    for (let reveal = 0; reveal < 8; reveal += 1) {
      playRevealYield({ own: true, amount: 150, resourceId: (100 + reveal) as ResourcesIds, from: TILE, now: reveal });
    }
    expect(flights).toHaveLength(6);
    flights[0].onArrive?.(0);
    playRevealYield({ own: true, amount: 150, resourceId: 200 as ResourcesIds, from: TILE, now: 10 });
    expect(flights).toHaveLength(7);
  });

  it("flies to the banked counter and keeps its old number until the icon lands", async () => {
    const { playRevealYield } = await load();
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

    await act(async () => playRevealYield({ own: true, amount: 150, resourceId: LABOR, from: TILE, now: 0 }));
    await act(async () => root.render(<Counter value={1_400} />));
    expect(flights[0].to).toBe(host.firstChild);
    expect(host.textContent).toBe("1250");

    await act(async () => flights[0].onArrive?.(0));
    expect(host.textContent).toBe("1400");
    await act(async () => root.unmount());
  });

  it("sends another player's reveal up from its tile with its amount, silently, even with a counter on screen", async () => {
    const { playRevealYield } = await load();
    mountCounter(bankedCounterTarget(LABOR));
    playRevealYield({ own: false, amount: 150, resourceId: LABOR, from: TILE, now: 0 });
    expect(flights).toHaveLength(0);
    expect(rises).toEqual([expect.objectContaining({ at: TILE, label: "+150" })]);
    expect(plays).toHaveLength(0);
  });

  it("raises the player's own reveal on its tile with its amount when no counter is on screen, as in Blitz", async () => {
    const { playRevealYield } = await load();
    playRevealYield({ own: true, amount: 0.1, resourceId: LABOR, from: TILE, now: 0 });
    expect(flights).toHaveLength(0);
    expect(rises).toEqual([expect.objectContaining({ at: TILE, label: "+0.1" })]);
    expect(plays).toHaveLength(1);
  });
});
