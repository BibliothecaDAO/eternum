import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildingName, FRONTIER_TROOP_NAMES, TroopType } from "@bibliothecadao/types";
import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { HOLD_MS } from "@/ui/design-system/kit/named-tips";
import { Tooltip } from "@/ui/design-system/molecules/tooltip";
import { CLOSE, COMBAT_MARK_WORDS, TROOP_TRAIT_WORDS, UNIT_DETAILS_WORDS } from "@/ui/design-system/kit/words";

import { troopTraits } from "../deploy/troop-figures";
import { PRESET_TROOP_FIGURES } from "../research/progression-fixture";
import { buildingForTroop } from "./troop-traits-card";
import { UnitDetailsTrigger, type UnitDetailsSubject } from "./unit-details-popover";

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
  useTooltipStore.setState({ tooltip: null });
  vi.useRealTimers();
});

const pointerEvent = (type: string, init: PointerEventInit) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: init.clientX, clientY: init.clientY });
  Object.defineProperty(event, "pointerType", { value: init.pointerType ?? "mouse" });
  return event;
};

const popover = () => document.querySelector<HTMLElement>("[data-unit-details-popover]");

const knightSubject: UnitDetailsSubject = {
  role: "player",
  name: FRONTIER_TROOP_NAMES[TroopType.Knight].many,
  art: "knight-t1",
  category: TroopType.Knight,
  strength: 1_500,
  figures: PRESET_TROOP_FIGURES,
};

describe("UnitDetailsTrigger", () => {
  it("opens on touch hold at HOLD_MS, suppresses trailing click, context menu, and competing tooltips, and cancels on early release or drag", () => {
    vi.useFakeTimers();
    const onInnerClick = vi.fn();
    act(() =>
      root.render(
        <>
          <Tooltip />
          <UnitDetailsTrigger subject={knightSubject} openOnClick={false}>
            <button type="button" data-tip="Competing slot tip" onClick={onInnerClick}>
              Tile
            </button>
          </UnitDetailsTrigger>
        </>,
      ),
    );
    const trigger = host.querySelector<HTMLElement>("[data-unit-details-trigger]")!;

    act(() => {
      trigger.dispatchEvent(pointerEvent("pointerdown", { pointerType: "touch", clientX: 50, clientY: 50 }));
      vi.advanceTimersByTime(HOLD_MS - 100);
      trigger.dispatchEvent(pointerEvent("pointerup", { pointerType: "touch", clientX: 50, clientY: 50 }));
      vi.advanceTimersByTime(HOLD_MS);
    });
    expect(popover()).toBeNull();
    expect(document.querySelector('[role="tooltip"]')).toBeNull();

    act(() => {
      trigger.dispatchEvent(pointerEvent("pointerdown", { pointerType: "touch", clientX: 50, clientY: 50 }));
      trigger.dispatchEvent(pointerEvent("pointermove", { pointerType: "touch", clientX: 70, clientY: 50 }));
      vi.advanceTimersByTime(HOLD_MS + 50);
    });
    expect(popover()).toBeNull();

    act(() => {
      trigger.dispatchEvent(pointerEvent("pointerdown", { pointerType: "touch", clientX: 50, clientY: 50 }));
      vi.advanceTimersByTime(HOLD_MS);
    });
    expect(popover()).not.toBeNull();
    expect(document.querySelector('[role="tooltip"]')).toBeNull();

    const contextEvent = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    act(() => {
      trigger.dispatchEvent(contextEvent);
    });
    expect(contextEvent.defaultPrevented).toBe(true);

    act(() => {
      host.querySelector("button")!.click();
    });
    expect(onInnerClick).not.toHaveBeenCalled();
  });

  it("opens on desktop hover and click without stacking competing tooltips, and dismisses via Escape, Close button, or outside press", () => {
    vi.useFakeTimers();
    act(() =>
      root.render(
        <>
          <Tooltip />
          <span data-tip="Outer fight side line">
            <UnitDetailsTrigger subject={knightSubject} openOnClick>
              <span>Portrait</span>
            </UnitDetailsTrigger>
          </span>
        </>,
      ),
    );
    const trigger = host.querySelector<HTMLElement>("[data-unit-details-trigger]")!;

    act(() => {
      trigger.dispatchEvent(pointerEvent("pointerover", { pointerType: "mouse" }));
    });
    expect(popover()).not.toBeNull();
    expect(popover()!.getAttribute("role")).toBe("note");
    expect(popover()!.hasAttribute("data-pinned")).toBe(false);
    expect(document.querySelector('[role="tooltip"]')).toBeNull();

    act(() => {
      trigger.dispatchEvent(pointerEvent("pointerout", { pointerType: "mouse" }));
    });
    expect(popover()).toBeNull();

    act(() => {
      trigger.click();
    });
    expect(popover()).not.toBeNull();
    expect(popover()!.getAttribute("role")).toBe("dialog");
    expect(popover()!.hasAttribute("data-pinned")).toBe(true);

    act(() => {
      popover()!.querySelector<HTMLButtonElement>(`button[aria-label="${CLOSE}"]`)!.click();
    });
    expect(popover()).toBeNull();

    act(() => {
      trigger.click();
    });
    expect(popover()).not.toBeNull();
    act(() => {
      popover()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(popover()).toBeNull();

    act(() => {
      trigger.click();
    });
    expect(popover()).not.toBeNull();
    act(() => {
      document.body.dispatchEvent(pointerEvent("pointerdown", { pointerType: "mouse" }));
    });
    expect(popover()).toBeNull();
  });

  it("renders class, plain traits, and building source for every player unit without dot-minus or em-dashes", () => {
    for (const category of [TroopType.Knight, TroopType.Crossbowman, TroopType.Paladin]) {
      const subject: UnitDetailsSubject = {
        role: "player",
        name: FRONTIER_TROOP_NAMES[category].many,
        art: "knight-t1",
        category,
        strength: 2_000,
        figures: PRESET_TROOP_FIGURES,
      };
      act(() =>
        root.render(
          <UnitDetailsTrigger subject={subject} openOnClick>
            <span>Unit</span>
          </UnitDetailsTrigger>,
        ),
      );
      act(() => {
        host.querySelector<HTMLElement>("[data-unit-details-trigger]")!.click();
      });
      const card = popover()!;
      const traits = troopTraits(category);
      expect(card.textContent).toContain(COMBAT_MARK_WORDS[traits.mark]);
      expect(card.textContent).toContain(UNIT_DETAILS_WORDS.headline(traits, PRESET_TROOP_FIGURES));
      expect(card.textContent).toContain(UNIT_DETAILS_WORDS.strikeRule[traits.mark]);
      expect(card.textContent).toContain(TROOP_TRAIT_WORDS.damageValue(traits, PRESET_TROOP_FIGURES));
      expect(card.textContent).toContain(buildingName(buildingForTroop(category), true));
      expect(card.textContent).not.toContain("· -");
      expect(card.textContent).not.toContain("—");
      act(() => {
        card.querySelector<HTMLButtonElement>(`button[aria-label="${CLOSE}"]`)!.click();
      });
    }
  });

  it("renders class, beast rule, guard bonus, and matchup for beasts, Deep guards, and enemy armies", () => {
    const subjects: { subject: UnitDetailsSubject; expectedMark: string; expectedMatchup: string }[] = [
      {
        subject: {
          role: "beast",
          name: "Fairy",
          art: "beast-dark-fey",
          category: TroopType.Crossbowman,
          strength: 1_100,
          figures: PRESET_TROOP_FIGURES,
          vsCategory: TroopType.Knight,
        },
        expectedMark: COMBAT_MARK_WORDS.bow,
        expectedMatchup: UNIT_DETAILS_WORDS.matchup.defender,
      },
      {
        subject: {
          role: "deepBeast",
          name: "Wyvern",
          art: "beast-wyvern",
          category: TroopType.Knight,
          strength: 15_000,
          figures: PRESET_TROOP_FIGURES,
          vsCategory: TroopType.Crossbowman,
        },
        expectedMark: COMBAT_MARK_WORDS.blade,
        expectedMatchup: UNIT_DETAILS_WORDS.matchup.attacker,
      },
      {
        subject: {
          role: "enemyGuard",
          name: "Vex",
          art: "knight-t1",
          category: TroopType.Knight,
          strength: 1_200,
          figures: PRESET_TROOP_FIGURES,
          vsCategory: TroopType.Knight,
        },
        expectedMark: COMBAT_MARK_WORDS.blade,
        expectedMatchup: UNIT_DETAILS_WORDS.matchup.simultaneous,
      },
    ];
    for (const { subject, expectedMark, expectedMatchup } of subjects) {
      act(() =>
        root.render(
          <UnitDetailsTrigger subject={subject} openOnClick>
            <span>Enemy</span>
          </UnitDetailsTrigger>,
        ),
      );
      act(() => {
        host.querySelector<HTMLElement>("[data-unit-details-trigger]")!.click();
      });
      const card = popover()!;
      expect(card.textContent).toContain(subject.name);
      expect(card.textContent).toContain(expectedMark);
      expect(card.textContent).toContain(UNIT_DETAILS_WORDS.role[subject.role]);
      expect(card.textContent).toContain(expectedMatchup);
      if (subject.role === "enemyGuard") {
        expect(card.textContent).toContain(TROOP_TRAIT_WORDS.guardValue(PRESET_TROOP_FIGURES));
      }
      expect(card.textContent).not.toContain("· -");
      expect(card.textContent).not.toContain("—");
      act(() => {
        card.querySelector<HTMLButtonElement>(`button[aria-label="${CLOSE}"]`)!.click();
      });
    }
  });

  it("shows oath-adjusted reveal and attack stamina costs when staminaCosts are provided for a deployed army", () => {
    act(() =>
      root.render(
        <UnitDetailsTrigger
          subject={{
            ...knightSubject,
            staminaCosts: { reveal: 10, attack: 15 },
          }}
          openOnClick
        >
          <span>Oath Army</span>
        </UnitDetailsTrigger>,
      ),
    );
    act(() => {
      host.querySelector<HTMLElement>("[data-unit-details-trigger]")!.click();
    });
    const card = popover()!;
    expect(card.textContent).toContain(UNIT_DETAILS_WORDS.staminaPerTile(10));
    expect(card.textContent).toContain(UNIT_DETAILS_WORDS.staminaCost(15));
  });

  it("places the popover beside a desktop HUD sheet so hovering Deploy troop tiles never occludes sheet controls", () => {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1920 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 1080 });
    try {
      act(() =>
        root.render(
          <section data-kit-sheet="">
            <UnitDetailsTrigger subject={knightSubject} openOnClick={false}>
              <button type="button">Scouts</button>
            </UnitDetailsTrigger>
          </section>,
        ),
      );
      const sheet = host.querySelector<HTMLElement>("[data-kit-sheet]")!;
      const trigger = host.querySelector<HTMLElement>("[data-unit-details-trigger]")!;
      vi.spyOn(sheet, "getBoundingClientRect").mockReturnValue(new DOMRect(1500, 72, 400, 340));
      vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(new DOMRect(1660, 140, 180, 92));

      act(() => {
        trigger.dispatchEvent(pointerEvent("pointerover", { pointerType: "mouse" }));
      });
      const card = popover()!;
      expect(card.hasAttribute("data-pinned")).toBe(false);
      expect(card.getAttribute("role")).toBe("note");
      expect(parseInt(card.style.left, 10) + 304).toBeLessThanOrEqual(1500);
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
      Object.defineProperty(window, "innerHeight", { configurable: true, value: originalHeight });
    }
  });
});
