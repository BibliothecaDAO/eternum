import { expect, it } from "vitest";
import { buildStoryEventPresentation } from "./story-event-formatter";

it("uses the winning owner structure from Herald even when survivors format with separators", () => {
  const presentation = buildStoryEventPresentation({
    storyType: "BattleStory",
    storyPayload: {
      attacker_id: "0x25848",
      defender_id: "0x253a4",
      winner_id: "0x2581f",
      attacker_owner_id: "0x2581f",
      defender_owner_id: "0x25381",
      attacker_owner_address: "0x123",
      defender_owner_address: "0x456",
      attacker_troops_before: "0x3289eee6a00",
      attacker_troops_lost: "0x649534e00",
      defender_troops_before: "0x174876e800",
      defender_troops_lost: "0x174876e800",
    },
  } as Parameters<typeof buildStoryEventPresentation>[0]);
  expect(presentation.description).toContain("Winner: Attacker");
  expect(presentation.description).not.toContain("Winner: Draw");
});
