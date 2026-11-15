import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AspectPicker, aspectOffer, type AspectMembers } from "./aspect-picker";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MEMBERS: AspectMembers = { 1: 38, 2: 21, 3: 1, 4: 0 };
/** The Order of the Fox, a Guile Order (orders.ts). */
const FOX = 4;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

const draw = (props: Partial<Parameters<typeof AspectPicker>[0]> = {}) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const onJoin = props.onJoin ?? vi.fn();
  act(() =>
    root!.render(
      <AspectPicker members={MEMBERS} realmOrder={null} joining={null} offered={null} onJoin={onJoin} {...props} />,
    ),
  );
  return { onJoin, cards: [...host.querySelectorAll<HTMLButtonElement>(".aspect-picker__card")] };
};

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe("AspectPicker", () => {
  it("offers the four Aspects in the design's order, each with its four crests and its members", () => {
    const { cards } = draw();
    expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
      "Join Might",
      "Join Harmony",
      "Join Chaos",
      "Join Guile",
    ]);
    expect(cards.map((card) => card.querySelector(".aspect-picker__members")?.textContent)).toEqual([
      "38 members",
      "21 members",
      "1 member",
      "0 members",
    ]);
    expect(cards[0]!.querySelectorAll("img")).toHaveLength(4);
  });

  it("joins the Aspect tapped, with one tap", () => {
    const { onJoin, cards } = draw();
    act(() => cards[2]!.click());
    expect(onJoin).toHaveBeenCalledTimes(1);
    expect(onJoin).toHaveBeenCalledWith(3);
  });

  it("spins the Aspect being joined and lets no other card be tapped", () => {
    const { onJoin, cards } = draw({ joining: 2 });
    expect(cards[1]!.getAttribute("aria-label")).toBe("Joining Harmony…");
    expect(cards[1]!.getAttribute("aria-busy")).toBe("true");
    expect(cards.every((card) => card.disabled)).toBe(true);
    act(() => cards[3]!.click());
    expect(onJoin).not.toHaveBeenCalled();
  });

  it("shows a held Realm's home the Aspect of its Order, chosen, and asks nothing", () => {
    const { cards } = draw({ realmOrder: FOX });
    expect(host!.querySelector(".aspect-picker__head h2")?.textContent).toBe("Your Aspect");
    expect(host!.querySelector(".aspect-picker__head p")?.textContent).toBe(
      "Your Realm's Order of the Fox plays for Guile",
    );
    expect(cards.map((card) => card.hasAttribute("data-chosen"))).toEqual([false, false, false, true]);
    expect(cards.every((card) => card.disabled)).toBe(true);
  });

  it("draws no count while the members are being read", () => {
    const { cards } = draw({ members: null });
    expect(cards.some((card) => card.querySelector(".aspect-picker__members"))).toBe(false);
  });

  it("lists a friend's invited Aspect first, marked, names who invited, every card still open", () => {
    const { onJoin, cards } = draw({ offered: { aspect: 3, sender: "Linden" } });
    expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
      "Join Chaos",
      "Join Might",
      "Join Harmony",
      "Join Guile",
    ]);
    expect(cards.map((card) => card.querySelector(".aspect-picker__invite")?.textContent ?? null)).toEqual([
      "Invited",
      null,
      null,
      null,
    ]);
    expect(host!.querySelector(".aspect-picker__invited")?.textContent).toBe("Linden invited you to Chaos");
    expect(cards.every((card) => !card.disabled)).toBe(true);
    act(() => cards[3]!.click());
    expect(onJoin).toHaveBeenCalledWith(4);
  });

  it("names no sender when the invite's sender has no name yet", () => {
    draw({ offered: { aspect: 2, sender: null } });
    expect(host!.querySelector(".aspect-picker__invited")?.textContent).toBe("You were invited to Harmony");
  });

  it("keeps a held Realm's Aspect and the plain order whatever a link invited to", () => {
    const { cards } = draw({ realmOrder: FOX, offered: { aspect: 3, sender: "Linden" } });
    expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
      "Join Might",
      "Join Harmony",
      "Join Chaos",
      "Join Guile",
    ]);
    expect(host!.querySelector(".aspect-picker__invite")).toBeNull();
    expect(host!.querySelector(".aspect-picker__invited")).toBeNull();
    expect(cards.map((card) => card.hasAttribute("data-chosen"))).toEqual([false, false, false, true]);
  });
});

describe("aspectOffer", () => {
  const GAME = { chainId: "0x5245414c4d53", gameId: 8 };
  const link = { kind: "aspect" as const, chainId: GAME.chainId, gameId: 8, moment: 2, name: "Linden" };

  it("offers the Aspect of an invite made for this chain and game", () => {
    expect(aspectOffer(link, GAME)).toEqual({ aspect: 2, sender: "Linden" });
    expect(aspectOffer({ ...link, name: null }, GAME)).toEqual({ aspect: 2, sender: null });
  });

  it("offers nothing for another game, another chain, another kind of link or none", () => {
    expect(aspectOffer({ ...link, gameId: 9 }, GAME)).toBeNull();
    expect(aspectOffer({ ...link, chainId: "0x1" }, GAME)).toBeNull();
    expect(aspectOffer({ ...link, kind: "frontier-day" }, GAME)).toBeNull();
    expect(aspectOffer(null, GAME)).toBeNull();
  });

  it("refuses an invite whose Aspect the catalog does not hold", () => {
    expect(() => aspectOffer({ ...link, moment: 5 }, GAME)).toThrow("Unknown Aspect 5");
  });
});
