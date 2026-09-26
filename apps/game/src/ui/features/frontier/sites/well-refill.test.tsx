import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { armWellRefill, REFILL_BEAT_MS, useWellRefill } from "./well-refill";

const seen: Array<{ refilling: boolean; shown: number }> = [];
const Bar = ({ explorerId, ratio }: { explorerId: number; ratio: number }) => {
  const refill = useWellRefill(explorerId, ratio);
  useEffect(() => void seen.push(refill));
  return null;
};

describe("a Well's refill", () => {
  it("plays on the used army's bar when its stamina rises, sweeping up from the old fill", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    const host = document.createElement("div");
    const root = createRoot(host);
    const render = (ratio: number) => act(() => root.render(<Bar explorerId={201} ratio={ratio} />));

    render(0.2);
    // Stamina rising on its own plays nothing.
    render(0.25);
    expect(seen.at(-1)).toEqual({ refilling: false, shown: 0.25 });

    armWellRefill(201);
    render(0.75);
    expect(seen.some(({ refilling, shown }) => refilling && shown === 0.25)).toBe(true);
    act(() => vi.advanceTimersByTime(20));
    expect(seen.at(-1)).toEqual({ refilling: true, shown: 0.75 });
    act(() => vi.advanceTimersByTime(REFILL_BEAT_MS));
    expect(seen.at(-1)).toEqual({ refilling: false, shown: 0.75 });

    // The beat is spent: the next rise is ordinary.
    render(0.8);
    expect(seen.at(-1)).toEqual({ refilling: false, shown: 0.8 });
    act(() => root.unmount());
    vi.useRealTimers();
  });
});
