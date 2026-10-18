// @vitest-environment jsdom
import { ResourcesIds } from "@bibliothecadao/types";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { Tooltip } from "@/ui/design-system/molecules/tooltip";

vi.mock("@/ui/design-system/icon", () => ({ Icon: () => null }));

import { ProductionStatusBadge } from "./production-status-badge";

const ring = (props: { isProducing: boolean; timeRemainingSeconds: number | null }) => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    <ProductionStatusBadge resource={ResourcesIds.Wood} buildings={3} amount="1.3K" {...props} />,
  );
  return host;
};
/** The rim's badges, by where they sit: top-left buildings, top-right the time left, the foot the amount. */
const chip = (host: HTMLElement, place: "corner" | "timer" | "foot") =>
  host.querySelector(`[data-at="${place}"]`)?.textContent ?? null;

describe("the resource ring", () => {
  it("shows the production time left top right while it produces, in whole minutes, beside buildings and amount", () => {
    const host = ring({ isProducing: true, timeRemainingSeconds: 17 * 60 + 5 });
    expect(chip(host, "corner")).toBe("3");
    expect(chip(host, "timer")).toBe("18m");
    expect(chip(host, "foot")).toBe("1.3K");
    expect(chip(ring({ isProducing: true, timeRemainingSeconds: 3 * 3600 }), "timer")).toBe("3h");
  });

  it("writes the time left by its largest unit, the most that fits on the rim beside a count", () => {
    expect(chip(ring({ isProducing: true, timeRemainingSeconds: 7 * 3600 + 14 * 60 }), "timer")).toBe("7h");
    expect(chip(ring({ isProducing: true, timeRemainingSeconds: 23 * 3600 + 59 * 60 }), "timer")).toBe("23h");
    expect(chip(ring({ isProducing: true, timeRemainingSeconds: 3 * 86_400 + 4 * 3600 }), "timer")).toBe("3d");
  });

  it("shows no time while idle, without a known time, under a minute, or when production never runs out", () => {
    expect(chip(ring({ isProducing: false, timeRemainingSeconds: 600 }), "timer")).toBeNull();
    expect(chip(ring({ isProducing: true, timeRemainingSeconds: null }), "timer")).toBeNull();
    expect(chip(ring({ isProducing: true, timeRemainingSeconds: 45 }), "timer")).toBeNull();
    // A farm's wheat has no inputs to run out of: there is no time left to count, and its count stands alone.
    const endless = ring({ isProducing: true, timeRemainingSeconds: Number.POSITIVE_INFINITY });
    expect(chip(endless, "timer")).toBeNull();
    expect(chip(endless, "corner")).toBe("3");
  });

  it("tells producing from idle by its rim", () => {
    expect(
      ring({ isProducing: true, timeRemainingSeconds: 600 }).querySelector(".ui-ring")?.getAttribute("data-production"),
    ).toBe("producing");
    expect(
      ring({ isProducing: false, timeRemainingSeconds: null })
        .querySelector(".ui-ring")
        ?.getAttribute("data-production"),
    ).toBe("idle");
  });

  it("names the resource only on hover; the chips say the rest", () => {
    const host = ring({ isProducing: true, timeRemainingSeconds: 17 * 60 });
    const tooltip = host.querySelector("[data-tip]")?.getAttribute("data-tip");
    expect(tooltip).toBe("Wood");
  });
});

afterEach(() => useTooltipStore.setState({ tooltip: null }));

it.each([
  [ResourcesIds.Wood, "Wood"],
  [ResourcesIds.Crossbowman, "Crossbowman · T1"],
])("names resource %s on the one tooltip as %s, outside its clipping panel", (resource, name) => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <>
        <Tooltip />
        <ul data-testid="card" className="overflow-hidden">
          <li>
            <ProductionStatusBadge
              resource={resource}
              isProducing={false}
              timeRemainingSeconds={null}
              buildings={0}
              amount="1K"
            />
          </li>
        </ul>
      </>,
    ),
  );
  const ring = host.querySelector("[data-tip]")!;
  act(() => {
    const event = new MouseEvent("pointerover", { bubbles: true });
    Object.defineProperty(event, "pointerType", { value: "mouse" });
    ring.dispatchEvent(event);
  });
  const tooltip = document.querySelector('[role="tooltip"]');
  expect(tooltip?.textContent).toBe(name);
  expect(tooltip?.closest('[data-testid="card"]')).toBeNull();
  act(() => root.unmount());
  host.remove();
});
