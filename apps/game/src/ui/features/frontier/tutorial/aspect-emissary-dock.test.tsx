import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aspectName, aspects } from "@bibliothecadao/types";
import { OPENING_RULES } from "../opening/opening-fixtures";
import { AspectEmissaryDock } from "./aspect-emissary-dock";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("AspectEmissaryDock", () => {
  it("renders a compact desktop dock with the Aspect emblem, inline action text, and zero context block", () => {
    const onDismiss = vi.fn();
    const onSkipAll = vi.fn();

    act(() =>
      root.render(
        <AspectEmissaryDock moment="barracks" rules={OPENING_RULES} onDismiss={onDismiss} onSkipAll={onSkipAll} />,
      ),
    );

    const dock = host.querySelector<HTMLElement>("[data-tutorial-dock='barracks']");
    expect(dock).not.toBeNull();
    expect(dock?.dataset.tutorialAspect).toBe("2");
    expect(dock?.dataset.tutorialLayout).toBe("desktop");
    expect(dock?.textContent).toContain("Luminary");
    expect(dock?.textContent).toContain("Build a Barracks on the glowing plot. It raises +2/min Knights.");
    expect(dock?.textContent).toContain("Click the lit plot to build.");
    expect(host.querySelector(".emissary-dock__context")).toBeNull();
    expect(host.querySelector(".emissary-dock__well")).toBeNull();
    expect(host.querySelector(".emissary-dock__emblem-socket")).not.toBeNull();

    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
    expect(onDismiss).toHaveBeenCalledTimes(1);

    const skipButton = [...host.querySelectorAll("button")].find((button) => button.textContent === "Skip tutorial");
    act(() => skipButton!.click());
    expect(onSkipAll).toHaveBeenCalledTimes(1);
  });

  it("uses the player's own Aspect across all four Aspects for own-Aspect moments", () => {
    for (const aspect of aspects) {
      act(() =>
        root.render(
          <AspectEmissaryDock moment="deep" rules={{ ...OPENING_RULES, ownAspect: aspect.id }} onDismiss={vi.fn()} />,
        ),
      );
      const dock = host.querySelector<HTMLElement>("[data-tutorial-dock='deep']");
      expect(dock?.dataset.tutorialAspect).toBe(String(aspect.id));
      expect(dock?.textContent).toContain(aspectName(aspect.id));
    }
  });

  it("renders the compact phone layout without the desktop action phrase while keeping Skip tutorial reachable", () => {
    const onSkipAll = vi.fn();
    act(() =>
      root.render(
        <AspectEmissaryDock
          moment="explore"
          rules={OPENING_RULES}
          layout="phone"
          onDismiss={vi.fn()}
          onSkipAll={onSkipAll}
        />,
      ),
    );

    const dock = host.querySelector<HTMLElement>("[data-tutorial-dock='explore']");
    expect(dock?.classList.contains("emissary-dock--phone")).toBe(true);
    expect(dock?.textContent).toContain("Insight");
    expect(dock?.textContent).toContain("Reveal one dark hex for 20 stamina.");
    expect(host.querySelector(".emissary-dock__action")).toBeNull();
    const skipButton = [...host.querySelectorAll("button")].find((button) => button.textContent === "Skip tutorial");
    expect(skipButton).toBeDefined();
    act(() => skipButton!.click());
    expect(onSkipAll).toHaveBeenCalledTimes(1);
  });

  it("renders nothing for own-Aspect lessons while ownAspect is unknown", () => {
    act(() =>
      root.render(
        <AspectEmissaryDock moment="deep" rules={{ ...OPENING_RULES, ownAspect: undefined }} onDismiss={vi.fn()} />,
      ),
    );
    expect(host.querySelector("[data-tutorial-dock]")).toBeNull();
  });
});
