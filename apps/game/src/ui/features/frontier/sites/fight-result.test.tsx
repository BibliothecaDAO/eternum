import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useNowSeconds: () => 350,
  useCurrentArmiesTick: () => 3,
  useCurrentDefaultTick: () => 3,
  useBlockTimestamp: () => ({ currentArmiesTick: 3, armiesTickTimeRemaining: 60 }),
}));

import { closeFightResult, type FightSent, fightResultOf, lostArmyResult } from "./fight-result";
import { FightResultCard } from "./fight-result-card";
import { SITE } from "./site-fixture";

const SENT: FightSent = {
  targetId: SITE,
  site: "Camp",
  armyId: 201,
  armyArt: "/images/armies/knightT1.png",
  army: 1_498,
  clearPays: { pay: { icon: "La", amount: 550 }, xp: 82 },
};
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
    expect(fightResultOf(SENT, record([1_498, 1_318], [1_100, 0]))).toEqual(
      expect.objectContaining({ verdict: "victory", army: { before: 1_498, after: 1_318 }, gained: SENT.clearPays }),
    );
    expect(fightResultOf(SENT, record([1_498, 1_400], [1_100, 600]))).toEqual(
      expect.objectContaining({ verdict: "guard-holds", gained: null }),
    );
  });

  it("is the army's loss whenever the army is gone, whatever is left of the guard, and pays nothing", () => {
    expect(fightResultOf(SENT, record([1_498, 0], [1_100, 1_028]))).toEqual(
      expect.objectContaining({ verdict: "army-lost", guard: { before: 1_100, after: 1_028 }, gained: null }),
    );
    // Both sides fall in the same exchange: the army is still lost, and nothing is paid to it.
    expect(fightResultOf(SENT, record([1_498, 0], [1_100, 0]))).toEqual(
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
        <FightResultCard result={fightResultOf(SENT, record([1_498, 1_318], [1_100, 0]))} onClose={onClose} />,
      ),
    );
    const card = host.querySelector<HTMLButtonElement>('button[aria-label="Camp: Victory"]')!;
    expect(card.querySelector('[aria-label="Army 1,498 → 1,318"]')).not.toBeNull();
    expect(card.querySelector('[aria-label="troops 1,100 → 0"]')).not.toBeNull();
    expect(card.textContent).toContain("+550");
    expect(card.querySelector('[aria-label="XP +82"]')).not.toBeNull();
    act(() => card.click());
    expect(onClose).toHaveBeenCalled();
  });

  it("names a lost army and pays nothing", () => {
    act(() =>
      root.render(
        <FightResultCard result={fightResultOf(SENT, record([1_498, 0], [1_100, 1_028]))} onClose={() => {}} />,
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
