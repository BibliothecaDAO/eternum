import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

// The roll is framer-motion's number animation; stepping it by hand shows every value the counter writes.
const { rolls } = vi.hoisted(() => ({ rolls: [] as Array<{ from: number; to: number }> }));
vi.mock("framer-motion", () => ({
  animate: (from: unknown, to: unknown, options?: { onUpdate?: (value: number) => void; onComplete?: () => void }) => {
    if (typeof from === "number" && typeof to === "number") {
      rolls.push({ from, to });
      for (let step = 0; step <= 10; step += 1) options?.onUpdate?.(from + ((to - from) * step) / 10);
      options?.onComplete?.();
    }
    return { stop: () => {}, then: (resolve: () => void) => resolve() };
  },
}));
vi.mock("./motion-settings", () => ({ useReducedMotion: () => false }));

import { TickNumber } from "./tick-number";

afterEach(() => {
  rolls.length = 0;
  document.body.innerHTML = "";
});

describe("TickNumber", () => {
  it("rolls from the previous balance to the new one, never through values below it", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const shown: number[] = [];
    const record = (amount: number) => {
      shown.push(amount);
      return Math.round(amount).toLocaleString("en-US");
    };

    await act(async () => root.render(<TickNumber value={1_200} format={record} />));
    shown.length = 0;
    await act(async () => root.render(<TickNumber value={7_200} format={record} />));

    expect(rolls).toEqual([{ from: 1_200, to: 7_200 }]);
    expect(shown.length).toBeGreaterThan(2);
    expect(Math.min(...shown)).toBeGreaterThanOrEqual(1_200);
    expect(host.textContent).toBe("7,200");
    await act(async () => root.unmount());
  });
});
