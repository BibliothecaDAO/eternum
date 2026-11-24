import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aspectName, aspects } from "@bibliothecadao/types";
import { iconUrl } from "@/ui/design-system/icon-meaning";
import { OPENING_WORDS } from "@/ui/design-system/kit/words";
import { OPENING_MOMENTS, teacherAspectOf } from "../opening/opening";
import { OPENING_RULES } from "../opening/opening-fixtures";
import { ASPECT_EMISSARY_PORTRAITS } from "./aspect-emissaries";
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
  it("gives every Aspect its own shipped emissary portrait across all facet delivery sizes", () => {
    const seen = new Set<string>();
    for (const aspect of aspects) {
      const portrait = ASPECT_EMISSARY_PORTRAITS[aspect.id];
      expect(portrait).toBe(`emissary-${aspect.name.toLowerCase()}`);
      expect(seen.has(portrait)).toBe(false);
      seen.add(portrait);
      for (const pixels of [64, 128, 256] as const) {
        const url = iconUrl(portrait, pixels);
        expect(url).toBe(`/icons/facets/${pixels}/${portrait}.webp`);
        expect(existsSync(resolve("public", url.slice(1)))).toBe(true);
      }
    }
    expect(seen.size).toBe(aspects.length);
  });

  it("renders a compact desktop dock with the emissary portrait, Aspect medallion, inline action text, and zero context block", () => {
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
    const portrait = host.querySelector<HTMLImageElement>('img[data-icon="emissary-luminary"]');
    expect(portrait?.getAttribute("src")).toBe("/icons/facets/256/emissary-luminary.webp");
    expect(host.querySelector('[data-aspect-mark="2"]')).not.toBeNull();

    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
    expect(onDismiss).toHaveBeenCalledTimes(1);

    const skipButton = [...host.querySelectorAll("button")].find((button) => button.textContent === "Skip tutorial");
    act(() => skipButton!.click());
    expect(onSkipAll).toHaveBeenCalledTimes(1);
  });

  it("assigns every tutorial lesson an unmistakable catalog Aspect speaker with portrait, medallion, name, and color", () => {
    const validIds = new Set(aspects.map((aspect) => aspect.id));
    for (const moment of OPENING_MOMENTS) {
      const aspectId = teacherAspectOf(moment, OPENING_RULES.ownAspect);
      expect(aspectId, `${moment} must resolve to a catalog Aspect`).not.toBeNull();
      expect(validIds.has(aspectId!), `${moment} speaker must be in the Aspect catalog`).toBe(true);
      act(() => root.render(<AspectEmissaryDock moment={moment} rules={OPENING_RULES} onDismiss={vi.fn()} />));
      const dock = host.querySelector<HTMLElement>(`[data-tutorial-dock="${moment}"]`);
      expect(dock, `${moment} must render the dock`).not.toBeNull();
      expect(dock?.dataset.tutorialAspect).toBe(String(aspectId));
      expect(dock?.style.getPropertyValue("--hud-aspect").trim().length).toBeGreaterThan(0);
      expect(host.querySelector(".emissary-dock__aspect")?.textContent).toBe(aspectName(aspectId!));
      expect(host.querySelector(`img[data-icon="${ASPECT_EMISSARY_PORTRAITS[aspectId!]}"]`)).not.toBeNull();
      expect(host.querySelector(`[data-aspect-mark="${aspectId}"]`)).not.toBeNull();
    }
  });

  it("renders each Aspect's distinct emissary portrait and emblem across all four Aspects", () => {
    for (const aspect of aspects) {
      act(() =>
        root.render(
          <AspectEmissaryDock moment="deep" rules={{ ...OPENING_RULES, ownAspect: aspect.id }} onDismiss={vi.fn()} />,
        ),
      );
      const dock = host.querySelector<HTMLElement>("[data-tutorial-dock='deep']");
      const portrait = ASPECT_EMISSARY_PORTRAITS[aspect.id];
      expect(dock?.dataset.tutorialAspect).toBe(String(aspect.id));
      expect(dock?.textContent).toContain(aspectName(aspect.id));
      expect(host.querySelector(`img[data-icon="${portrait}"]`)?.getAttribute("src")).toBe(
        `/icons/facets/256/${portrait}.webp`,
      );
      expect(host.querySelector(`[data-aspect-mark="${aspect.id}"]`)).not.toBeNull();
    }
  });

  it("renders the compact phone layout with the action line, full title, portrait, and Skip tutorial", () => {
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
    expect(dock?.textContent).toContain(OPENING_WORDS.titles.explore);
    expect(dock?.textContent).toContain("Reveal one dark hex for 20 stamina.");
    expect(host.querySelector('img[data-icon="emissary-insight"]')?.getAttribute("src")).toBe(
      "/icons/facets/128/emissary-insight.webp",
    );
    expect(host.querySelector(".emissary-dock__action")?.textContent).toContain(OPENING_WORDS.actions.explore);
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

  it("renders the confirmed completion state with a tick, confirmation copy, and no skip or action cue", () => {
    const onDismiss = vi.fn();
    act(() =>
      root.render(
        <AspectEmissaryDock
          moment="explore"
          rules={OPENING_RULES}
          status="completed"
          onDismiss={onDismiss}
          onSkipAll={vi.fn()}
        />,
      ),
    );

    const dock = host.querySelector<HTMLElement>("[data-tutorial-dock='explore']");
    expect(dock).not.toBeNull();
    expect(dock?.dataset.tutorialStatus).toBe("completed");
    expect(dock?.classList.contains("emissary-dock--completed")).toBe(true);
    expect(host.querySelector('[role="status"]')?.textContent).toContain(OPENING_WORDS.completedLabel);
    expect(dock?.textContent).toContain(OPENING_WORDS.completed.explore);
    expect(host.querySelector(".emissary-dock__action")).toBeNull();
    expect(
      [...host.querySelectorAll("button")].find((button) => button.textContent === "Skip tutorial"),
    ).toBeUndefined();

    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
