import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { aspectName, DEEP_BEASTS, formatDuration, formatExact } from "@bibliothecadao/types";

import { ARMY, DEEP_WORDS, SLOT_ADD, SLOT_EMPTY, UNDEFENDED, YOU } from "@/ui/design-system/kit/words";
import { DEEP_SITE_CASES } from "./deep-site-fixtures";
import { DeepSiteView, type DeepSide, type DeepSiteProps } from "./deep-site-view";

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

const draw = (props: DeepSiteProps) => act(() => root.render(<DeepSiteView {...props} />));
const text = () => document.body.textContent ?? "";
const buttons = () => [...document.querySelectorAll<HTMLButtonElement>("section[role=dialog] button")];
const labels = (names: string[]) =>
  buttons().filter((button) => names.some((name) => button.textContent?.startsWith(name)));
const tag = () => document.querySelector("[data-deep-tag]")!;
const note = () => document.querySelector(".ui-window__foot")?.textContent;
const tiles = () =>
  [...document.querySelectorAll<HTMLElement>("[data-deep-guards] .deep-tile")].map((tile) => ({
    kind: tile.hasAttribute("data-deep-beast")
      ? "beast"
      : tile.hasAttribute("data-guard-slot")
        ? tile.getAttribute("data-side")
        : tile.getAttribute("data-empty"),
    first: tile.hasAttribute("data-first"),
    count: tile.querySelector(".deep-tile__count")?.textContent,
    owner: tile.querySelector(".deep-tile__owner")?.textContent,
    drain: tile.querySelector(".deep-tile__drain")?.textContent,
    button: tile.tagName === "BUTTON",
  }));
const LOSS = DEEP_SITE_CASES["Hyperstructure archive, open, its beast, army in reach"].rates.drain;
const slotDrain = DEEP_WORDS.slotDrain(LOSS, "2m");

describe("a Deep site's card", () => {
  it("names an unclaimed site and its ring, pays per army tick, and puts its beast first in the guard row", () => {
    const onAct = vi.fn();
    const props = DEEP_SITE_CASES["Hyperstructure archive, open, its beast, army in reach"];
    draw({ ...props, order: { kind: "attack", verb: "attack", stamina: 30, onAct } });
    expect([tag().getAttribute("data-deep-tag"), tag().textContent]).toEqual(["open", DEEP_WORDS.tag.open(1)]);
    expect(document.querySelector(".deep-title__name")?.textContent).toBe("Hyperstructure archive");
    expect(document.querySelector("[data-deep-holder]")).toBeNull();
    expect([...document.querySelectorAll("[data-rate]")].map((rate) => rate.getAttribute("data-rate"))).toEqual([
      "glory",
      "height",
    ]);
    expect(document.querySelector(".deep-purpose")?.textContent).toBe(DEEP_WORDS.purpose.foundation);
    expect(tiles()).toEqual([
      {
        kind: "beast",
        first: true,
        count: formatExact(15_000),
        owner: DEEP_BEASTS.foundation.name,
        drain: undefined,
        button: false,
      },
      ...Array.from({ length: 3 }, () => ({
        kind: "empty",
        first: false,
        count: undefined,
        owner: undefined,
        drain: undefined,
        button: false,
      })),
    ]);
    expect(document.querySelector("[data-deep-day-end]")).toBeNull();
    act(() => labels([DEEP_WORDS.attack])[0]!.click());
    expect(onAct).toHaveBeenCalledTimes(1);
  });

  it("keeps the close button on the header's one row beside the title", () => {
    draw(DEEP_SITE_CASES["Hyperstructure archive held by the player and an ally, army beside"]);
    const head = document.querySelector(".ui-frame__head > .ui-panel__head")!;
    expect([...head.children].map((part) => part.className)).toEqual(["ui-panel__name", "ui-panel__cue"]);
    expect(head.querySelector(".ui-panel__cue button")).not.toBeNull();
    expect(head.querySelector(".deep-purpose")).toBeNull();
  });

  it("tags a held site by the viewer's side, and a closed site by its ring", () => {
    const fixture = DEEP_SITE_CASES["Altar of banes held by a rival Aspect, attack ready"];
    const sides: DeepSide[] = ["own", "ally", "rival", "held"];
    const tags = sides.map((side) => {
      draw({ ...fixture, guard: { ...fixture.guard, side } });
      return [tag().getAttribute("data-deep-tag"), tag().textContent];
    });
    expect(tags).toEqual(sides.map((side) => [side, DEEP_WORDS.tag[side](aspectName(1), 2, 4)]));
    draw(DEEP_SITE_CASES["Bane altar, locked until more Realms enter"]);
    expect([tag().getAttribute("data-deep-tag"), tag().textContent]).toEqual(["locked", DEEP_WORDS.tag.locked(2)]);
  });

  it("shows an own-held site with four Blitz tiles, leftmost fought first, Glory badge, and working Guard and Withdraw", () => {
    const onGuard = vi.fn();
    const onWithdraw = vi.fn();
    const fixture = DEEP_SITE_CASES["Hyperstructure archive held by the player and an ally, army beside"];
    draw({
      ...fixture,
      order: {
        ...fixture.order,
        guard: { ...fixture.order.guard, onSend: onGuard },
        withdraw: { ...fixture.order.withdraw, onSend: onWithdraw },
      },
    });
    expect(document.querySelector("[data-deep-holder]")?.textContent).toBe(
      `${DEEP_WORDS.heldBy} Kael · ${aspectName(2)}`,
    );
    expect(document.querySelector("[data-deep-glory-won]")?.textContent).toBe(DEEP_WORDS.glory(148));
    expect(document.querySelector("[data-deep-day-end]")?.textContent).toBe(
      `${DEEP_WORDS.dayEndPoison(LOSS, "2m")} · ${DEEP_WORDS.dayEndLost}`,
    );
    expect(tiles()).toEqual([
      { kind: "ally", first: true, count: formatExact(800), owner: "Mira", drain: slotDrain, button: false },
      { kind: "own", first: false, count: formatExact(1_498), owner: YOU, drain: slotDrain, button: true },
      { kind: "empty", first: false, count: undefined, owner: undefined, drain: undefined, button: false },
      { kind: "empty", first: false, count: undefined, owner: undefined, drain: undefined, button: false },
    ]);
    const ownTile = document.querySelector<HTMLButtonElement>('[data-guard-slot][data-side="own"]')!;
    const expectedTime = formatDuration(Math.ceil(1_498 / LOSS) * 120, { days: false });
    expect(ownTile.getAttribute("data-tip")).toBe(
      DEEP_WORDS.slotTip(YOU, "Knights", 1_498, 9_000, 65, LOSS, "2m", expectedTime, true, 3.9),
    );
    const footButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-deep-foot] button")].map((b) =>
      b.textContent?.trim(),
    );
    expect(footButtons).toEqual([DEEP_WORDS.guardShort, DEEP_WORDS.withdraw]);
    const typeTransfer = (amount: number) => {
      const input = document.querySelector<HTMLInputElement>("[data-deep-transfer] input")!;
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, String(amount));
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };
    const confirmButton = () =>
      [...document.querySelectorAll<HTMLButtonElement>("[data-deep-transfer] button")].at(-1)!;
    act(() => document.querySelector<HTMLButtonElement>("[data-deep-foot] button")!.click());
    expect(document.querySelector("[data-deep-transfer='guard']")).not.toBeNull();
    expect(confirmButton().disabled).toBe(true);
    expect(text()).not.toContain(DEEP_WORDS.guardAll);
    typeTransfer(1_200);
    expect(text()).toContain(DEEP_WORDS.guardAll);
    act(() => labels([DEEP_WORDS.guardAmount(1_200)])[0]!.click());
    expect(onGuard).toHaveBeenCalledWith(1_200, undefined);
    act(() => ownTile.click());
    expect(document.querySelector("[data-deep-transfer='withdraw']")).not.toBeNull();
    expect(confirmButton().disabled).toBe(true);
    typeTransfer(500);
    act(() => labels([DEEP_WORDS.withdrawAmount(500)])[0]!.click());
    expect(onWithdraw).toHaveBeenCalledWith(500, 0);
    const onNewSlot = vi.fn();
    draw({
      ...fixture,
      order: {
        ...fixture.order,
        troops: { category: "Crossbowman", tier: "T1" },
        guard: { most: 1_200, onSend: onNewSlot },
        withdraw: undefined,
      },
    });
    expect(tiles().map((tile) => [tile.kind, tile.button])).toEqual([
      ["ally", false],
      ["own", false],
      ["add", true],
      ["add", true],
    ]);
    act(() => document.querySelector<HTMLButtonElement>('[data-empty="add"]')!.click());
    typeTransfer(400);
    act(() => labels([DEEP_WORDS.guardAmount(400)])[0]!.click());
    expect(onNewSlot).toHaveBeenCalledWith(400, 3);
  });

  it("marks an owned site with zero guards as undefended, shows the empty warning, and labels the CTA Add guard", () => {
    draw(DEEP_SITE_CASES["Hyperstructure archive held and undefended"]);
    expect([tag().getAttribute("data-deep-tag"), tag().textContent]).toEqual([
      "own",
      DEEP_WORDS.tag.own(aspectName(2), 0, 4),
    ]);
    expect(document.querySelector(".deep-guards__head")?.textContent).toBe(DEEP_WORDS.guardCount(0, 4) + UNDEFENDED);
    expect(document.querySelector("[data-deep-undefended]")?.textContent).toBe(DEEP_WORDS.undefendedLine);
    expect(document.querySelector("[data-deep-glory-won]")?.getAttribute("data-tip")).toBe(DEEP_WORDS.gloryIdleTip);
    expect(tiles()).toEqual(
      Array.from({ length: 4 }, () => ({
        kind: "add",
        first: false,
        count: undefined,
        owner: undefined,
        drain: undefined,
        button: true,
      })),
    );
    expect([...document.querySelectorAll('[data-empty="add"]')].map((node) => node.textContent)).toEqual([
      SLOT_ADD,
      SLOT_ADD,
      SLOT_ADD,
      SLOT_ADD,
    ]);
    expect(labels([DEEP_WORDS.addGuard])).toHaveLength(1);
  });

  it("shows a rival's guards with muted empty tiles, no Glory of the player's, and Attack on the first guard", () => {
    draw(DEEP_SITE_CASES["Altar of banes held by a rival Aspect, attack ready"]);
    expect(tiles().map((tile) => [tile.kind, tile.first, tile.button])).toEqual([
      ["rival", true, false],
      ["rival", false, false],
      ["empty", false, false],
      ["empty", false, false],
    ]);
    expect(document.querySelectorAll("[data-empty]")[0]?.textContent).toBe(SLOT_EMPTY);
    expect(document.querySelector(".deep-guards__head")?.textContent).toBe(
      DEEP_WORDS.guardCount(2, 4) + DEEP_WORDS.slotOrder.seize,
    );
    expect(document.querySelector("[data-deep-glory-won]")).toBeNull();
    expect(labels([DEEP_WORDS.attack])).toHaveLength(1);
    expect(document.querySelector("[data-attack-stamina='30']")).not.toBeNull();
  });

  it("says what a player of the holder's Aspect needs when no army stands beside or every slot is full", () => {
    draw(DEEP_SITE_CASES["Bane altar held by the player's Aspect, no army beside"]);
    expect(note()).toBe(DEEP_WORDS.noAdjacent);
    expect(document.querySelector("[data-empty]")?.textContent).toBe(SLOT_EMPTY);
    draw(DEEP_SITE_CASES["Hyperstructure archive, every guard slot full"]);
    expect(note()).toBe(DEEP_WORDS.slotsFull(4));
    expect(document.querySelector("[data-empty]")).toBeNull();
  });

  it("tells a player of the holder's Aspect that only the owner guards a Mine, its empty tiles muted", () => {
    draw(DEEP_SITE_CASES["Ethereal mine held by an ally, where only its owner guards"]);
    expect(note()).toBe(DEEP_WORDS.ownerOnly);
    expect(
      [...document.querySelectorAll("[data-empty]")].map((tile) => [tile.textContent, tile.getAttribute("data-tip")]),
    ).toEqual(Array.from({ length: 3 }, () => [SLOT_EMPTY, DEEP_WORDS.ownerOnly]));
    expect(labels([DEEP_WORDS.guardShort])).toHaveLength(0);
  });

  it("offers Take on a held site with no guard to a rival beside it, without telling the rival to place a guard", () => {
    const onAct = vi.fn();
    const undefended = DEEP_SITE_CASES["Hyperstructure archive held and undefended"];
    draw({
      ...undefended,
      guard: { ...undefended.guard, side: "rival" },
      order: { kind: "attack", verb: "take", stamina: 30, onAct },
    });
    expect(document.querySelector("[data-deep-undefended]")).toBeNull();
    expect(document.querySelector("[data-deep-glory-won]")).toBeNull();
    act(() => labels([DEEP_WORDS.take])[0]!.click());
    expect(onAct).toHaveBeenCalledTimes(1);
  });

  it("shows a locked site's yields without its pay, and how many Realms have entered of the ones it needs", () => {
    draw(DEEP_SITE_CASES["Bane altar, locked until more Realms enter"]);
    expect(document.querySelector("[data-deep-pay]")).toBeNull();
    expect(document.querySelector("[data-deep-kinds]")?.textContent).toBe(
      DEEP_WORDS.kinds.glory + DEEP_WORDS.kinds.bar + DEEP_WORDS.ratesWhenOpen,
    );
    expect(document.querySelector("[data-deep-opening]")?.textContent).toBe(
      DEEP_WORDS.opensAt(50) + DEEP_WORDS.entered(12, 50),
    );
    expect(document.querySelector("[data-deep-guards]")).toBeNull();
    expect(labels([DEEP_WORDS.attack])).toHaveLength(0);
  });

  it("holds Attack disabled and says why when the stamina is short", () => {
    draw(DEEP_SITE_CASES["Ethereal mine, its beast, army short of stamina"]);
    expect(labels([DEEP_WORDS.attack])[0]!.disabled).toBe(true);
    expect(text()).toContain("Needs 30 stamina, holds 12");
  });

  it("offers Move with its cost when the army is away, and shows the Bane bar's charge beside its rate", () => {
    const onMove = vi.fn();
    draw({
      ...DEEP_SITE_CASES["Bane altar, its beast, army away"],
      order: { kind: "move", prices: [{ of: "stamina", amount: 30 }], onMove },
    });
    expect(document.querySelector("[data-rate='bar']")?.textContent).toContain(DEEP_WORDS.bar(48, 120));
    act(() => labels(["Move"])[0]!.click());
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it("faces the rival's first guard in the fight, named by its owner", () => {
    draw(DEEP_SITE_CASES["Altar of banes, the rival guard's fight forecast"]);
    const sides = [...document.querySelectorAll(".fight-side")];
    expect(sides).toHaveLength(2);
    expect(sides[0]!.getAttribute("aria-label")?.startsWith(`${ARMY} 12,400 → 11,850`)).toBe(true);
    expect(sides[1]!.getAttribute("aria-label")).toContain("Vex 1,200 → 0");
    expect(sides[1]!.querySelector("[data-aspect-mark='1']")).not.toBeNull();
  });

  it("shows the beast's fight above the guard row, the Blade or Bow on the beast's portrait", () => {
    draw(DEEP_SITE_CASES["Hyperstructure archive, the beast's fight forecast"]);
    const theirs = document.querySelector("[data-fight-side='theirs']")!;
    expect(theirs.querySelector("[data-combat-mark='Blade']")).not.toBeNull();
    expect(theirs.textContent).toContain("Defeated");
    expect(document.querySelector("[data-deep-beast]")).not.toBeNull();
  });
});
