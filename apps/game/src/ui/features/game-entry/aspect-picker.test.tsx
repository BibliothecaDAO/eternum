import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AspectPicker, type AspectMembers } from "./aspect-picker";

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
    root!.render(<AspectPicker members={MEMBERS} realmOrder={null} joining={null} onJoin={onJoin} {...props} />),
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
});
