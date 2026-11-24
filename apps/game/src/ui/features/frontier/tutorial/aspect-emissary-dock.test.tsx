import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aspectName, aspects } from "@bibliothecadao/types";
import { iconUrl } from "@/ui/design-system/icon-meaning";
import { HudSheet } from "@/ui/design-system/kit/hud-elements";
import { BUILD, CLOSE, MENU, OPENING_WORDS, SETTINGS } from "@/ui/design-system/kit/words";
import { OPENING_MOMENTS, teacherAspectOf, type OpeningMoment } from "../opening/opening";
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
    expect(dock?.textContent).toContain("It raises +2/min Knights.");
    expect(dock?.textContent).toContain("Tap the lit plot to build.");
    expect(host.querySelector(".emissary-dock__context")).toBeNull();
    expect(host.querySelector(".emissary-dock__well")).toBeNull();
    const portrait = host.querySelector<HTMLImageElement>('img[data-icon="emissary-luminary"]');
    expect(portrait?.getAttribute("src")).toBe("/icons/facets/256/emissary-luminary.webp");
    expect(host.querySelector('[data-aspect-mark="2"]')).not.toBeNull();

    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
    expect(onDismiss).toHaveBeenCalledTimes(1);

    const pressSkip = () =>
      act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Skip tutorial")!.click());
    pressSkip();
    expect(onSkipAll).not.toHaveBeenCalled();
    expect(dock?.textContent).toContain(OPENING_WORDS.skipFinal);
    expect(host.querySelector('button[aria-label="Close"]')).toBeNull();
    expect(host.querySelector(".emissary-dock__action")).toBeNull();

    act(() =>
      [...host.querySelectorAll("button")].find((button) => button.textContent === OPENING_WORDS.keepTutorial)!.click(),
    );
    expect(dock?.textContent).not.toContain(OPENING_WORDS.skipFinal);
    expect(onSkipAll).not.toHaveBeenCalled();

    pressSkip();
    pressSkip();
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
    expect(dock?.textContent).toContain(OPENING_WORDS.titles.explore());
    expect(dock?.textContent).toContain("Reveal a dark hex for 20 stamina.");
    expect(host.querySelector('img[data-icon="emissary-insight"]')?.getAttribute("src")).toBe(
      "/icons/facets/128/emissary-insight.webp",
    );
    expect(host.querySelector(".emissary-dock__action")?.textContent).toContain(OPENING_WORDS.actions.explore);
    const pressSkip = () =>
      act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Skip tutorial")!.click());
    pressSkip();
    expect(dock?.textContent).toContain(OPENING_WORDS.skipFinal);
    pressSkip();
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
    expect(dock?.textContent).toContain(OPENING_WORDS.completed.explore.line);
    expect(host.querySelector(".emissary-dock__action")).toBeNull();
    expect(
      [...host.querySelectorAll("button")].find((button) => button.textContent === "Skip tutorial"),
    ).toBeUndefined();

    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("keeps a confirmed line while a panel hides it, and retires it 6 s after it is on screen", () => {
    vi.useFakeTimers();
    const observers: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
          observers.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    try {
      const onDismiss = vi.fn();
      act(() =>
        root.render(
          <AspectEmissaryDock moment="aspects" rules={OPENING_RULES} status="completed" onDismiss={onDismiss} />,
        ),
      );
      act(() => observers.at(-1)!([{ isIntersecting: false }]));
      act(() => vi.advanceTimersByTime(60_000));
      expect(onDismiss).not.toHaveBeenCalled();

      act(() => observers.at(-1)!([{ isIntersecting: true }]));
      act(() => vi.advanceTimersByTime(5_999));
      expect(onDismiss).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(onDismiss).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("draws a phone's lesson as the still does: portrait, title, one line, the gold action and its close, no speaker name", () => {
    act(() =>
      root.render(
        <AspectEmissaryDock moment="explore" rules={OPENING_RULES} layout="phone" onDismiss={vi.fn()} onSkipAll={vi.fn()} />,
      ),
    );
    const dock = host.querySelector<HTMLElement>("[data-tutorial-dock='explore']")!;
    expect(dock.querySelector(".emissary-dock__title")?.textContent).toBe(OPENING_WORDS.titles.explore());
    expect(dock.querySelector(".emissary-dock__line")?.textContent).toBe(OPENING_WORDS.lines.explore(OPENING_RULES));
    expect(dock.querySelector(".emissary-dock__action")?.textContent).toBe(OPENING_WORDS.actions.explore);
    expect(dock.querySelector('button[aria-label="Close"]')).not.toBeNull();
    expect(dock.querySelector(".emissary-dock__aspect")).toBeNull();
    expect(dock.querySelector(".emissary-dock__crest")).toBeNull();
  });

  it("draws a phone's done lesson with a tick, its confirmation title and line, and nothing to press", () => {
    act(() =>
      root.render(
        <AspectEmissaryDock moment="barracks" rules={OPENING_RULES} layout="phone" status="completed" onDismiss={vi.fn()} />,
      ),
    );
    const dock = host.querySelector<HTMLElement>("[data-tutorial-dock='barracks']")!;
    expect(dock.querySelector(".emissary-dock__title")?.textContent).toBe(`✓${OPENING_WORDS.completed.barracks.title}`);
    expect(dock.querySelector(".emissary-dock__line")?.textContent).toBe(OPENING_WORDS.completed.barracks.line);
    expect(dock.querySelector("button")).toBeNull();
    expect(dock.querySelector(".emissary-dock__action")).toBeNull();
  });

  it("titles the day-end lesson with the time the day has left", () => {
    act(() =>
      root.render(
        <AspectEmissaryDock
          moment="day-end"
          rules={{ ...OPENING_RULES, dayLeftSeconds: 30 * 60 }}
          layout="phone"
          onDismiss={vi.fn()}
        />,
      ),
    );
    expect(host.querySelector(".emissary-dock__title")?.textContent).toBe("Day ends in 30m");
  });

  it("never retires a lesson that is still showing", () => {
    vi.useFakeTimers();
    try {
      const onDismiss = vi.fn();
      act(() => root.render(<AspectEmissaryDock moment="barracks" rules={OPENING_RULES} onDismiss={onDismiss} />));
      act(() => vi.advanceTimersByTime(60_000));
      expect(onDismiss).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  const renderOverSheet = (moment: OpeningMoment, sheet: string | null, layout: "phone" | "desktop" = "phone") => {
    const onDismiss = vi.fn();
    const onSkipAll = vi.fn();
    act(() =>
      root.render(
        <>
          <AspectEmissaryDock
            moment={moment}
            rules={OPENING_RULES}
            layout={layout}
            onDismiss={onDismiss}
            onSkipAll={onSkipAll}
          />
          {sheet && (
            <HudSheet label={sheet} onClose={vi.fn()}>
              <p>sheet</p>
            </HudSheet>
          )}
        </>,
      ),
    );
    return { dock: () => host.querySelector<HTMLElement>("[data-tutorial-dock]")!, onDismiss, onSkipAll };
  };
  const press = (name: string) =>
    act(() =>
      [...host.querySelectorAll<HTMLButtonElement>("[data-tutorial-dock] button")]
        .find((button) => button.textContent === name || button.getAttribute("aria-label") === name)!
        .click(),
    );

  it("folds to the guidance strip over the sheet its lesson asks for, keeping Skip's two steps", () => {
    const { dock, onSkipAll } = renderOverSheet("barracks", BUILD);
    expect(dock().dataset.tutorialForm).toBe("strip");
    expect(dock().textContent).toContain(OPENING_WORDS.titles.barracks());
    expect(dock().textContent).toContain(OPENING_WORDS.inSheet.barracks(OPENING_RULES));
    expect(dock().querySelector(`button[aria-label="${CLOSE}"]`)).toBeNull();

    press(OPENING_WORDS.skipTutorial);
    expect(dock().textContent).toContain(OPENING_WORDS.skipFinal);
    expect(onSkipAll).not.toHaveBeenCalled();
    press(OPENING_WORDS.skipTutorial);
    expect(onSkipAll).toHaveBeenCalledTimes(1);
  });

  it("folds to the one-line reminder over any other sheet, which expands to the card and closes the lesson", () => {
    const { dock, onDismiss } = renderOverSheet("barracks", SETTINGS);
    expect(dock().dataset.tutorialForm).toBe("reminder");
    expect(dock().textContent).toContain(OPENING_WORDS.tutorial);
    expect(dock().textContent).toContain(OPENING_WORDS.titles.barracks());

    press(OPENING_WORDS.showLesson);
    expect(dock().dataset.tutorialForm).toBe("card");
    expect(dock().textContent).toContain(OPENING_WORDS.lines.barracks(OPENING_RULES));

    renderOverSheet("barracks", null);
    expect(dock().dataset.tutorialForm).toBe("card");
    renderOverSheet("barracks", SETTINGS);
    expect(dock().dataset.tutorialForm).toBe("reminder");
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("folds again when one sheet replaces another in the same moment", () => {
    const { dock } = renderOverSheet("barracks", SETTINGS);
    press(OPENING_WORDS.showLesson);
    expect(dock().dataset.tutorialForm).toBe("card");
    renderOverSheet("barracks", MENU);
    expect(dock().dataset.tutorialForm).toBe("reminder");
  });

  it("closes the lesson from the reminder's cross", () => {
    const { onDismiss } = renderOverSheet("deploy", SETTINGS);
    press(CLOSE);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("keeps the full card on a desktop, where sheets stand in the rail", () => {
    const { dock } = renderOverSheet("barracks", SETTINGS, "desktop");
    expect(dock().dataset.tutorialForm).toBe("card");
  });
});
