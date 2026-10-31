import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { Tooltip } from "@/ui/design-system/molecules/tooltip";

import { HudButton, HudChip } from "./hud-elements";

let host: HTMLDivElement;
let root: Root;

const pointer = (type: string, target: Element, pointerType: "mouse" | "touch", at = { x: 10, y: 10 }) =>
  act(() => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y });
    Object.defineProperty(event, "pointerType", { value: pointerType });
    target.dispatchEvent(event);
  });

const tip = () => document.querySelector('[role="tooltip"]')?.textContent ?? null;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useTooltipStore.setState({ tooltip: null });
  vi.useRealTimers();
});

const mount = (onClick = () => undefined) =>
  act(() =>
    root.render(
      <>
        <Tooltip />
        <button type="button" data-testid="army" onClick={onClick}>
          <HudChip icons={["stamina"]} label="stamina">
            150
          </HudChip>
        </button>
        <span role="img" aria-label="Common">
          Common
        </span>
        <HudButton kind="primary">Deploy</HudButton>
        <span data-testid="store" data-tip="Wheat 1,771 of 6,000 · +302 an hour · Full in 14h">
          1,771
        </span>
        <p data-testid="plain">plain</p>
      </>,
    ),
  );

describe("a name on the one tooltip", () => {
  it("shows a chip's name while the mouse is over it and takes it away when the mouse leaves", () => {
    mount();
    pointer("pointerover", host.querySelector('[role="img"]')!, "mouse");
    expect(tip()).toBe("stamina 150");
    pointer("pointerover", host.querySelector('[data-testid="plain"]')!, "mouse");
    expect(tip()).toBeNull();
  });

  it("says a line of its own in place of the bare name", () => {
    mount();
    pointer("pointerover", host.querySelector('[data-testid="store"]')!, "mouse");
    expect(tip()).toBe("Wheat 1,771 of 6,000 · +302 an hour · Full in 14h");
  });

  it("never repeats a name the screen already shows in words", () => {
    mount();
    pointer("pointerover", host.querySelector('[aria-label="Common"]')!, "mouse");
    expect(tip()).toBeNull();
    pointer(
      "pointerover",
      [...host.querySelectorAll("button")].find((button) => button.textContent === "Deploy")!,
      "mouse",
    );
    expect(tip()).toBeNull();
  });

  it("never repeats words a row already shows whole, and says them where they are cut off at its edge", () => {
    act(() =>
      root.render(
        <>
          <Tooltip />
          <span data-testid="row" data-tip="Explored: +150 Labor">
            Explored: +150 Labor
          </span>
          <p data-testid="plain">plain</p>
        </>,
      ),
    );
    const row = host.querySelector<HTMLElement>('[data-testid="row"]')!;
    pointer("pointerover", row, "mouse");
    expect(tip()).toBeNull();
    pointer("pointerover", host.querySelector('[data-testid="plain"]')!, "mouse");
    Object.defineProperty(row, "scrollWidth", { configurable: true, value: 240 });
    Object.defineProperty(row, "clientWidth", { configurable: true, value: 120 });
    pointer("pointerover", row, "mouse");
    expect(tip()).toBe("Explored: +150 Labor");
  });

  it("shows the name after a press-and-hold on a touch screen, and the hold is not a tap", () => {
    const onClick = vi.fn();
    mount(onClick);
    const chip = host.querySelector('[role="img"]')!;
    pointer("pointerdown", chip, "touch");
    expect(tip()).toBeNull();
    act(() => void vi.advanceTimersByTime(500));
    expect(tip()).toBe("stamina 150");
    pointer("pointerup", chip, "touch");
    act(() => (chip as HTMLElement).click());
    expect(onClick).not.toHaveBeenCalled();
    expect(tip()).toBe("stamina 150");
    act(() => void vi.advanceTimersByTime(2_000));
    expect(tip()).toBeNull();
  });

  it("leaves a short press the tap it always was, and a finger that scrolls asks for nothing", () => {
    const onClick = vi.fn();
    mount(onClick);
    const chip = host.querySelector('[role="img"]')!;
    pointer("pointerdown", chip, "touch");
    pointer("pointerup", chip, "touch");
    act(() => (chip as HTMLElement).click());
    expect(onClick).toHaveBeenCalledTimes(1);
    pointer("pointerdown", chip, "touch");
    pointer("pointermove", chip, "touch", { x: 10, y: 60 });
    act(() => void vi.advanceTimersByTime(500));
    expect(tip()).toBeNull();
  });

  // Owner, 28 October 2026: "why is there a ruin". A ruin's chest, a full-screen button named Ruin, pinned its name
  // at the screen's right edge.
  it("names nothing that covers the whole screen, as a backdrop does, by mouse or by hold", () => {
    act(() =>
      root.render(
        <>
          <Tooltip />
          <button type="button" aria-label="Ruin" />
        </>,
      ),
    );
    const layer = host.querySelector<HTMLElement>('button[aria-label="Ruin"]')!;
    const sized = (width: number, height: number) =>
      (layer.getBoundingClientRect = () => ({ left: 0, top: 0, width, height }) as DOMRect);

    sized(window.innerWidth, window.innerHeight);
    pointer("pointerover", layer, "mouse");
    expect(tip()).toBeNull();
    pointer("pointerdown", layer, "touch");
    act(() => void vi.advanceTimersByTime(500));
    expect(tip()).toBeNull();
    pointer("pointerup", layer, "touch");

    // The same control as a thing on the screen still says its name.
    sized(44, 44);
    pointer("pointerover", host, "mouse");
    pointer("pointerover", layer, "mouse");
    expect(tip()).toBe("Ruin");
  });
});

// Playtest 10-31: the realm panel's wheat ring named itself over the panel's own header.
describe("a tip never covers the card its thing belongs to", () => {
  type Box = { left: number; top: number; width: number; height: number };
  const at = (element: Element, { left, top, width, height }: Box) =>
    (element.getBoundingClientRect = () =>
      ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top }) as DOMRect);
  /** A card holding a store ring, both laid out where `card` and `ring` say, on a screen `screen` wide and tall. */
  const hoverRingIn = (card: Box, ring: Box, screen: { width: number; height: number }) => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(screen.width);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(screen.height);
    act(() =>
      root.render(
        <>
          <Tooltip />
          <section className="ui ui-panel" aria-label="Realm">
            <span data-testid="ring" data-tip="Wheat 229 of 6,000 · +36/min · Full in 2h 40m">
              230
            </span>
          </section>
        </>,
      ),
    );
    at(host.querySelector(".ui-panel")!, card);
    at(host.querySelector('[data-testid="ring"]')!, ring);
    pointer("pointerover", host.querySelector('[data-testid="ring"]')!, "mouse");
    act(() => void vi.advanceTimersByTime(20));
    const placed = document.querySelector<HTMLElement>('[role="tooltip"]')!;
    return {
      left: parseFloat(placed.style.left),
      top: parseFloat(placed.style.top),
      placement: placed.dataset.placement,
    };
  };
  afterEach(() => vi.restoreAllMocks());

  it("stands beside a desktop's column card, at its thing's height, on the side facing the map", () => {
    const card = { left: 10, top: 52, width: 270, height: 230 };
    const tip = hoverRingIn(card, { left: 125, top: 135, width: 40, height: 40 }, { width: 1440, height: 900 });
    expect(tip.placement).toBe("right");
    expect(tip.left).toBeGreaterThanOrEqual(card.left + card.width);
  });

  it("stands above a phone's sheet that spans the screen's width, where the map has room", () => {
    const card = { left: 0, top: 500, width: 390, height: 344 };
    const tip = hoverRingIn(card, { left: 175, top: 540, width: 40, height: 40 }, { width: 390, height: 844 });
    expect(tip.placement).toBe("top");
    expect(tip.top).toBeLessThan(card.top);
  });
});
