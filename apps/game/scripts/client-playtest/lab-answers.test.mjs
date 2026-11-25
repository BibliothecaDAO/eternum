import { expect, it } from "vitest";

import { balanceChange, troopChange } from "./lab-answers.mjs";

const answer = {
  answered: [
    { model: "StoryEvent", value: { story: "ExplorerCreateStory" } },
    { model: "ResourceBalance", value: { resource_type: 35, balance: "1200" } },
    { model: "ResourceBalance", value: { resource_type: 38, balance: "50" } },
    { model: "ExplorerTroops", value: { explorer_id: 201, troops: { count: "1902" } } },
  ],
  before: [null, { resource_type: 35, balance: "2000" }, null, { explorer_id: 201, troops: { count: "1498" } }],
};

it("reads how an answer moved a balance: what it wrote less what the chain held before, a new row from nothing", () => {
  expect(balanceChange(answer, 35)).toBe(-800n);
  expect(balanceChange(answer, 38)).toBe(50n);
  expect(balanceChange(answer, 26)).toBeUndefined();
  expect(balanceChange(undefined, 35)).toBeUndefined();
});

it("reads how an answer moved an army's troops, by its id or the one army it wrote", () => {
  expect(troopChange(answer)).toBe(404n);
  expect(troopChange(answer, 201)).toBe(404n);
  expect(troopChange(answer, 202)).toBeUndefined();
});
