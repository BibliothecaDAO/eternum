import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useNowSeconds: () => 350,
  useCurrentArmiesTick: () => 3,
  useCurrentDefaultTick: () => 3,
  useBlockTimestamp: () => ({ currentArmiesTick: 3, armiesTickTimeRemaining: 60 }),
}));

import { closeFightResult, type FightGain, type FightSent, fightResultOf, lostArmyResult } from "./fight-result";
import { FightResultCard } from "./fight-result-card";
import { SITE } from "./site-fixture";

const SENT: FightSent = {
  targetId: SITE,
  site: "Camp",
  armyId: 201,
  armyArt: "knight-t1",
  army: 1_498,
  homeId: 7,
  clearXp: 82,
};
/** What the clear's own record paid, as the card's caller reads it. */
const PAID: FightGain = { pay: { icon: "labor", amount: 550, storeFull: false }, xp: 82 };
const paid = () => PAID;
const record = (army: [number, number], guard: [number, number]) => ({
  army: { before: army[0], after: army[1] },
  guard: { before: guard[0], after: guard[1] },
});

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
  closeFightResult();
});

describe("an attack's result, from the battle's own record", () => {
  it("is a victory that pays when the army stands and the guard is gone, else the guard holding", () => {
    expect(fightResultOf(SENT, record([1_498, 1_318], [1_100, 0]), paid)).toEqual(
      expect.objectContaining({ verdict: "victory", army: { before: 1_498, after: 1_318 }, gained: PAID }),
    );
    expect(fightResultOf(SENT, record([1_498, 1_400], [1_100, 600]), paid)).toEqual(
      expect.objectContaining({ verdict: "guard-holds", gained: null }),
    );
  });

  it("is the army's loss whenever the army is gone, whatever is left of the guard, and pays nothing", () => {
    expect(fightResultOf(SENT, record([1_498, 0], [1_100, 1_028]), paid)).toEqual(
      expect.objectContaining({ verdict: "army-lost", guard: { before: 1_100, after: 1_028 }, gained: null }),
    );
    // Both sides fall in the same exchange: the army is still lost, and nothing is paid to it.
    expect(fightResultOf(SENT, record([1_498, 0], [1_100, 0]), paid)).toEqual(
      expect.objectContaining({ verdict: "army-lost", gained: null }),
    );
  });

  it("says only that the army was lost when no record of the battle is known", () => {
    expect(lostArmyResult(SENT)).toEqual({
      site: "Camp",
      verdict: "army-lost",
      armyArt: SENT.armyArt,
      army: { before: 1_498, after: 0 },
      guard: null,
      gained: null,
    });
  });
});

describe("the result card", () => {
  it("says the one word, each side before and after, and what a clear paid, and goes with a tap", () => {
    const onClose = vi.fn();
    act(() =>
      root.render(
        <FightResultCard result={fightResultOf(SENT, record([1_498, 1_318], [1_100, 0]), paid)} onClose={onClose} />,
      ),
    );
    const card = host.querySelector<HTMLButtonElement>('button[aria-label="Camp: Victory"]')!;
    expect(card.querySelector('[aria-label="Army 1,498 → 1,318"]')).not.toBeNull();
    expect(card.querySelector('[aria-label="troops 1,100 → 0"]')).not.toBeNull();
    expect(card.textContent).toContain("+550");
    expect(card.textContent).toContain("+82 XP");
    act(() => card.click());
    expect(onClose).toHaveBeenCalled();
  });

  it("marks the reward Full, with the line that the rest did not fit, when the store that took it is at its limit", () => {
    const full = () => ({ ...PAID, pay: { ...PAID.pay!, storeFull: true } });
    act(() =>
      root.render(
        <FightResultCard result={fightResultOf(SENT, record([1_498, 1_318], [1_100, 0]), full)} onClose={() => {}} />,
      ),
    );
    const card = host.querySelector('button[aria-label="Camp: Victory"]')!;
    // The figure is still the reward the record names; the mark says the store could not take all of it.
    expect(card.textContent).toContain("+550");
    const mark = card.querySelector('[aria-label="Store Full"]')!;
    expect(mark.getAttribute("data-tip")).toBe("The store is full: the rest did not fit");
    expect(mark.getAttribute("data-tone")).toBe("bad");
  });

  it("carries no Full mark while the store has room", () => {
    act(() =>
      root.render(
        <FightResultCard result={fightResultOf(SENT, record([1_498, 1_318], [1_100, 0]), paid)} onClose={() => {}} />,
      ),
    );
    expect(host.querySelector('[aria-label="Store Full"]')).toBeNull();
  });

  it("names a lost army and pays nothing", () => {
    act(() =>
      root.render(
        <FightResultCard result={fightResultOf(SENT, record([1_498, 0], [1_100, 1_028]), paid)} onClose={() => {}} />,
      ),
    );
    const card = host.querySelector('button[aria-label="Camp: Army lost"]')!;
    expect(card.querySelector('[aria-label="Army 1,498 → 0"]')).not.toBeNull();
    expect(card.querySelector('[aria-label="troops 1,100 → 1,028"]')).not.toBeNull();
    expect(card.querySelector('[aria-label^="XP"]')).toBeNull();
  });

  it("shows the lost army alone when nothing is known of the other side", () => {
    act(() => root.render(<FightResultCard result={lostArmyResult(SENT)} onClose={() => {}} />));
    const card = host.querySelector('button[aria-label="Camp: Army lost"]')!;
    expect(card.querySelector('[aria-label="Army 1,498 → 0"]')).not.toBeNull();
    expect(card.querySelector('[aria-label^="troops"]')).toBeNull();
    expect(card.textContent).not.toContain("+");
  });
});
