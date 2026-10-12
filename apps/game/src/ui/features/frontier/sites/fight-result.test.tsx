import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useNowSeconds: () => 350,
  useCurrentArmiesTick: () => 3,
  useCurrentDefaultTick: () => 3,
  useBlockTimestamp: () => ({ currentArmiesTick: 3, armiesTickTimeRemaining: 60 }),
}));

import { GameProvider } from "@/hooks/context/game-context";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";

import { closeFightResult, type FightSent, fightIsSent, readFightResult, useFightResult } from "./fight-result";
import { FightResultCard } from "./fight-result-card";
import { useFightWatch } from "./fight-watch";
import { campBeside, SITE } from "./site-fixture";

const PRECISION = 1_000_000_000n;
const SENT: FightSent = {
  siteId: SITE,
  site: "Camp",
  armyId: 201,
  armyArt: "/images/armies/knightT1.png",
  army: 1_498,
  guard: 1_100,
  clearPays: { pay: { icon: "La", amount: 550 }, xp: 82 },
};

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

describe("an attack's result", () => {
  it("waits while both sides still read as they were sent", () => {
    expect(readFightResult(SENT, { army: 1_498, guard: 1_100 })).toBeNull();
  });

  it("is a victory that pays when the guard is gone, the army's loss when the army is, else the guard holding", () => {
    expect(readFightResult(SENT, { army: 1_318, guard: 0 })).toEqual(
      expect.objectContaining({ verdict: "victory", army: { before: 1_498, after: 1_318 }, gained: SENT.clearPays }),
    );
    expect(readFightResult(SENT, { army: 0, guard: 1_028 })).toEqual(
      expect.objectContaining({ verdict: "army-lost", guard: { before: 1_100, after: 1_028 }, gained: null }),
    );
    expect(readFightResult(SENT, { army: 1_400, guard: 600 })).toEqual(
      expect.objectContaining({ verdict: "guard-holds", gained: null }),
    );
  });
});

describe("the result card", () => {
  it("says the one word, each side before and after, and what a clear paid, and goes with a tap", () => {
    const onClose = vi.fn();
    act(() =>
      root.render(<FightResultCard result={readFightResult(SENT, { army: 1_318, guard: 0 })!} onClose={onClose} />),
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
      root.render(<FightResultCard result={readFightResult(SENT, { army: 0, guard: 1_028 })!} onClose={() => {}} />),
    );
    const card = host.querySelector('button[aria-label="Camp: Army lost"]')!;
    expect(card.querySelector('[aria-label="Army 1,498 → 0"]')).not.toBeNull();
    expect(card.querySelector('[aria-label^="XP"]')).toBeNull();
  });
});

describe("the player's attack in flight", () => {
  const Watch = () => {
    useFightWatch();
    const result = useFightResult();
    return <output>{result ? `${result.verdict} ${result.army.after} ${result.guard.after}` : "waiting"}</output>;
  };

  it("ends on its result as soon as the facts carry what it did, with no event", () => {
    const { store } = campBeside();
    const guard = store.require("Guard", { game_id: 1, structure_id: SITE, slot: 0 });
    const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <Watch />
        </GameProvider>,
      ),
    );
    act(() => fightIsSent(SENT));
    expect(host.textContent).toBe("waiting");

    act(() =>
      store.applyFacts([
        {
          model: "Guard",
          key: "0x73",
          value: wire({ ...guard, troops: { ...guard.troops, count: 600n * PRECISION } }),
        },
        {
          model: "ExplorerTroops",
          key: "0x74",
          value: wire({ ...army, troops: { ...army.troops, count: 1_400n * PRECISION } }),
        },
      ] as never),
    );
    expect(host.textContent).toBe("guard-holds 1400 600");
  });
});

/** A decoded row back in the wire's form: big integers as strings. */
const wire = (row: unknown): unknown =>
  JSON.parse(JSON.stringify(row, (_, value) => (typeof value === "bigint" ? value.toString() : value)));
