import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { Tooltip } from "@/ui/design-system/molecules/tooltip";

import { Button } from "./button";
import { HudChip } from "./hud-elements";
import { TierChip } from "./tier-chip";

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
        <TierChip tier={1} showWord />
        <Button role="primary" word="Deploy" />
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
});
