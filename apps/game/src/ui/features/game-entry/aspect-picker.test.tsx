import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ordersOfAspect } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AspectPicker, aspectOffer, type AspectMembers } from "./aspect-picker";
import { ASPECT_STEP_WORDS } from "../../design-system/kit/words";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MEMBERS: AspectMembers = { 1: 38, 2: 21, 3: 1, 4: 0 };
const FOX = 4;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

const draw = (props: Partial<Parameters<typeof AspectPicker>[0]> = {}) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const onChoose = props.onChoose ?? vi.fn();
  const onFound = props.onFound ?? vi.fn();
  act(() =>
    root!.render(
      <AspectPicker
        members={MEMBERS}
        realmOrder={null}
        keptOrder={null}
        chosen={null}
        joining={null}
        offered={null}
        onChoose={onChoose}
        onFound={onFound}
        {...props}
      />,
    ),
  );
  return {
    onChoose,
    onFound,
    cards: [...host.querySelectorAll<HTMLButtonElement>(".app-aspect-card")],
    orders: [...host.querySelectorAll<HTMLButtonElement>(".aspect-picker__order")],
  };
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
      "Join Prowess",
      "Join Luminary",
      "Join Havoc",
      "Join Insight",
    ]);
    expect(cards.map((card) => card.querySelector(".aspect-picker__members")?.textContent)).toEqual([
      "38 members",
      "21 members",
      "1 member",
      "0 members",
    ]);
    expect(cards[0]!.querySelector('[data-aspect-mark="1"]')).not.toBeNull();
    expect(cards[0]!.querySelectorAll('[data-icon^="order-"]')).toHaveLength(4);
  });

  it("chooses the Aspect tapped and founds nothing until an Order is tapped", () => {
    const { onChoose, onFound, cards, orders } = draw();
    expect(orders).toHaveLength(0);
    act(() => cards[2]!.click());
    expect(onChoose).toHaveBeenCalledWith(3);
    expect(onFound).not.toHaveBeenCalled();
  });

  it("offers the chosen Aspect's four Orders and founds in the Order tapped", () => {
    const havoc = ordersOfAspect(3);
    const { onFound, cards, orders } = draw({ chosen: 3 });
    expect(cards.map((card) => card.getAttribute("aria-pressed") === "true")).toEqual([false, false, true, false]);
    expect(orders.map((order) => order.getAttribute("aria-label"))).toEqual(
      havoc.map(({ fullOrderName }) => `Play as ${fullOrderName}`),
    );
    act(() => orders[1]!.click());
    expect(onFound).toHaveBeenCalledTimes(1);
    expect(onFound).toHaveBeenCalledWith(havoc[1]!.orderId);
  });

  it("spins the Order being founded in and lets nothing else be tapped", () => {
    const luminary = ordersOfAspect(2)[0]!;
    const { onChoose, onFound, cards, orders } = draw({ chosen: 2, joining: luminary.orderId });
    expect(cards[1]!.getAttribute("aria-label")).toBe("Joining Luminary…");
    expect(cards[1]!.getAttribute("aria-busy")).toBe("true");
    expect(orders[0]!.getAttribute("aria-label")).toBe(`Creating Realm as ${luminary.fullOrderName}…`);
    expect([...cards, ...orders].every((button) => button.disabled)).toBe(true);
    act(() => cards[3]!.click());
    act(() => orders[1]!.click());
    expect(onChoose).not.toHaveBeenCalled();
    expect(onFound).not.toHaveBeenCalled();
  });

  it("shows a held Realm's home the Aspect of its Order, chosen, and asks nothing", () => {
    const { cards, orders } = draw({ realmOrder: FOX, chosen: 1 });
    expect(orders).toHaveLength(0);
    expect(host!.querySelector(".aspect-picker__head h2")?.textContent).toBe("Your Aspect");
    expect(host!.querySelector(".aspect-picker__head p")?.textContent).toBe(
      ASPECT_STEP_WORDS.realmsAspect("Order of the Fox", "Insight"),
    );
    expect(cards.map((card) => card.getAttribute("aria-pressed") === "true")).toEqual([false, false, false, true]);
    expect(cards.every((card) => card.disabled)).toBe(true);
  });

  it("draws no count while the members are being read", () => {
    const { cards } = draw({ members: null });
    expect(cards.some((card) => card.querySelector(".aspect-picker__members"))).toBe(false);
  });

  it("lists a friend's invited Aspect first, marked, names who invited, every card still open", () => {
    const { onChoose, cards } = draw({ offered: { aspect: 3, sender: "Linden" } });
    expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
      "Join Havoc",
      "Join Prowess",
      "Join Luminary",
      "Join Insight",
    ]);
    expect(cards.map((card) => card.querySelector("[data-aspect-invited]")?.textContent ?? null)).toEqual([
      "Invited",
      null,
      null,
      null,
    ]);
    expect(host!.querySelector(".aspect-picker__invited")?.textContent).toBe(ASPECT_STEP_WORDS.invitedTo("Linden", "Havoc"));
    expect(cards.every((card) => !card.disabled)).toBe(true);
    act(() => cards[3]!.click());
    expect(onChoose).toHaveBeenCalledWith(4);
  });

  it("names no sender when the invite's sender has no name yet", () => {
    draw({ offered: { aspect: 2, sender: null } });
    expect(host!.querySelector(".aspect-picker__invited")?.textContent).toBe(ASPECT_STEP_WORDS.invitedTo(null, "Luminary"));
  });

  it("keeps a held Realm's Aspect and the plain order whatever a link invited to", () => {
    const { cards } = draw({ realmOrder: FOX, offered: { aspect: 3, sender: "Linden" } });
    expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
      "Join Prowess",
      "Join Luminary",
      "Join Havoc",
      "Join Insight",
    ]);
    expect(host!.querySelector("[data-aspect-invited]")).toBeNull();
    expect(host!.querySelector(".aspect-picker__invited")).toBeNull();
    expect(cards.map((card) => card.getAttribute("aria-pressed") === "true")).toEqual([false, false, false, true]);
  });
});

describe("aspectOffer", () => {
  const GAME = { chainId: "0x5245414c4d53", gameId: 8 };
  const link = { kind: "aspect" as const, chainId: GAME.chainId, gameId: 8, moment: 2, name: "Linden" };

  it("offers the Aspect of an invite made for this chain and game", () => {
    expect(aspectOffer(link, GAME)).toEqual({ aspect: 2, sender: "Linden" });
    expect(aspectOffer({ ...link, name: null }, GAME)).toEqual({ aspect: 2, sender: null });
  });

  it("offers the Aspect of an invite made before the season, in whichever game founds the home", () => {
    expect(aspectOffer({ kind: "aspect", chainId: null, gameId: null, moment: 3, name: "Dana" }, GAME)).toEqual({
      aspect: 3,
      sender: "Dana",
    });
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
