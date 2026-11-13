import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { BOON_KINDS, type BoonKind } from "./boon-catalog";
import { ArmyBoonsLine, BoonSheet } from "./boon-sheet";
import { armyBoons, type BoonFacts, readBoonSheet } from "./boon-sheet-plan";

const none = (): Record<BoonKind, number> =>
  Object.fromEntries(BOON_KINDS.map((boon) => [boon, 0])) as Record<BoonKind, number>;
/** Might's Orders (reports/s1-xp-3.md): Power gives War, Giants Ward, Titans Spoils, Skill Paths. */
const POWER = 12;
const GIANTS = 1;
const TITANS = 13;
const SKILL = 9;
const knight = (steps: Partial<Record<BoonKind, number>>, rank: 1 | 2 | 3 | 4 | 5 = 3): BoonFacts => ({
  troop: "knight",
  steps: { ...none(), ...steps },
  offers: [
    {
      rank,
      // Stored in any order: the sheet puts the army's own giver first, then Ward and Spoils.
      cards: [
        { order: TITANS, boon: "lore" },
        { order: POWER, boon: "battle" },
        { order: GIANTS, boon: "guard" },
      ],
    },
    {
      rank: 1,
      cards: [
        { order: POWER, boon: "charge" },
        { order: GIANTS, boon: "vigour" },
        { order: TITANS, boon: "plunder" },
      ],
    },
  ],
});

it("lays a Knight's point out as its three givers in their places: War, Ward, Spoils", () => {
  const plan = readBoonSheet(knight({ battle: 2 }))!;
  expect(plan.cards.map(({ orderName, boon }) => `${orderName} ${boon}`)).toEqual([
    "Power battle",
    "Giants guard",
    "Titans lore",
  ]);
  // A Rare point (3) on Battle at 2: five steps, nothing over, +50% damage; rest gives 60 stamina; one point waits.
  expect(plan.cards[0]).toMatchObject({ from: 2, to: 5, effect: "+50% damage", stamina: 0 });
  expect(plan).toMatchObject({ rank: 3, rest: 60, waiting: 1 });
});

it("turns the steps past five back into 20 stamina each: a Legendary into a boon at 3 gives 2 steps and 60 stamina", () => {
  const plan = readBoonSheet(knight({ battle: 3 }, 5))!;
  expect(plan.cards[0]).toMatchObject({ from: 3, to: 5, stamina: 60 });
  expect(plan.rest).toBe(100);
});

it("puts a Scout's own giver first, and refuses a boon its troop is not offered", () => {
  const scout: BoonFacts = {
    troop: "scout",
    steps: none(),
    offers: [
      {
        rank: 2,
        cards: [
          { order: GIANTS, boon: "vigour" },
          { order: SKILL, boon: "camps" },
          { order: TITANS, boon: "plunder" },
        ],
      },
    ],
  };
  expect(readBoonSheet(scout)!.cards.map(({ boon }) => boon)).toEqual(["camps", "vigour", "plunder"]);
  expect(readBoonSheet(scout)!.cards[0]).toMatchObject({ effect: "+50% camp odds", to: 2 });
  expect(() => readBoonSheet({ ...scout, troop: "knight" })).toThrow("not offered to a knight army");
});

it("has no sheet while no point waits", () => {
  expect(readBoonSheet({ troop: "knight", steps: none(), offers: [] })).toBeNull();
});

it("draws the cards with the Order's crest, the steps and the effect; a tap takes a boon, Rest rests", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const picked = vi.fn();
  act(() => root.render(<BoonSheet plan={readBoonSheet(knight({ battle: 2 }))!} onPick={picked} onClose={() => {}} />));
  const cards = [...host.querySelectorAll("[data-boon-cards] button")];
  expect(cards.map((card) => card.getAttribute("data-boon"))).toEqual(["battle", "guard", "lore"]);
  expect(cards[0]!.textContent).toContain("Power");
  expect(cards[0]!.textContent).toContain("+50% damage");
  expect(cards[0]!.querySelector('[aria-label="2 → 5 of 5 steps"]')).not.toBeNull();
  expect(host.textContent).toContain("1 more point after this one");
  act(() => (cards[1] as HTMLButtonElement).click());
  expect(picked).toHaveBeenCalledWith("guard");
  act(() => root.unmount());
  host.remove();
});

it("lists the boons an army holds on its line, in the catalog's order, and nothing while it holds none", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  expect(armyBoons({ ...none(), lore: 1, battle: 5 })).toEqual([
    { boon: "battle", steps: 5 },
    { boon: "lore", steps: 1 },
  ]);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<ArmyBoonsLine steps={{ ...none(), vigour: 2 }} />));
  expect(host.querySelector("[data-army-boons]")?.textContent).toBe("2");
  act(() => root.render(<ArmyBoonsLine steps={none()} />));
  expect(host.querySelector("[data-army-boons]")).toBeNull();
  act(() => root.unmount());
  host.remove();
});
