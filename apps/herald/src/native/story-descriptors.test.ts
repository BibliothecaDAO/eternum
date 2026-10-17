import { buildStoryEventPresentation } from "@bibliothecadao/eternum";
import { GUARD_SLOT_NAMES, GuardSlot } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { toJsonValue } from "../model-registry";
import { manifest, raw, schema, setup } from "./fixtures";

const categories = ["Knight", "Paladin", "Crossbowman"];
const tiers = ["T1", "T2", "T3"];
const directions = ["East", "NorthEast", "NorthWest", "West", "SouthWest", "SouthEast"];
const slots = ["Delta", "Gamma", "Beta", "Alpha"];

function decodedStory(name: string, payload: number[]) {
  const story = schema.types["world_native::ownership::Story"];
  if (story.type !== "enum") throw new Error("Missing compiled story enum");
  const variant = story.variants.findIndex((variant) => variant.name === name);
  if (variant < 0) throw new Error(`Missing story ${name}`);
  const layout = schema.games.events.find((event) => event.name === "StoryEvent")!;
  const decoded = setup().decoder.decode(
    raw({
      from_address: manifest.world.address,
      keys: [...layout.prefix, "2", "1", "0", "0x123", "0", "3", "0x55"],
      data: [String(variant), ...payload.map(String), "140"],
    }),
  );
  if (decoded.kind !== "event") throw new Error("Expected story event");
  const value = toJsonValue(decoded.value) as { story: Record<string, Record<string, unknown>> };
  return value.story[name];
}

/** What a player reads for a compiled story: its title and description as one line. */
function renderedStory(storyType: string, payload: number[]) {
  const storyPayload = decodedStory(storyType, payload);
  const { title, description } = buildStoryEventPresentation({
    storyType,
    storyPayload,
    ownerAddress: "0x123",
    ownerName: null,
    entityId: null,
    txHash: "0x55",
    timestamp: 140,
    rawStory: { [storyType]: storyPayload },
  });
  return `${title} · ${description ?? ""}`;
}

// The decoded fields carry the chain's values (troop kind and tier, guard slot, spawn direction); what a player reads
// names the troops and the slot's wall in plain words, never the slot's internal name, and leaves the spawn direction
// out (the owner ruled it debug wording).
describe("compiled native story descriptors", () => {
  for (const [category, categoryName] of categories.entries()) {
    for (const [tier, tierName] of tiers.entries()) {
      for (const [slot, slotName] of slots.entries()) {
        it(`decodes and tells ${tierName} ${categoryName} in ${slotName}`, () => {
          const payload = [3, slot, category, tier, 1_000_000];
          expect(decodedStory("GuardAddStory", payload)).toMatchObject({
            slot: `0x${slot.toString(16)}`,
            category: categoryName,
            tier: tierName,
          });
          const told = renderedStory("GuardAddStory", payload);
          expect(told).toContain(`${categoryName} ${tierName}`);
          expect(told).toContain(GUARD_SLOT_NAMES[GuardSlot[slotName as keyof typeof GuardSlot]]);
          expect(told).not.toMatch(new RegExp(`\\b${slotName}\\b`));
        });
      }
      for (const [direction, directionName] of directions.entries()) {
        it(`decodes ${tierName} ${categoryName} spawning ${directionName}, and tells it without the direction`, () => {
          const payload = [7, 3, category, tier, 1_000_000, direction];
          expect(decodedStory("ExplorerCreateStory", payload)).toMatchObject({
            category: categoryName,
            tier: tierName,
            spawn_direction: directionName,
          });
          const told = renderedStory("ExplorerCreateStory", payload);
          expect(told).toContain(`${categoryName} ${tierName}`);
          expect(told).not.toMatch(/East|West|Spawn/);
        });
      }
    }
  }

  it.each([
    ["GuardAddStory", [3, 0, 3, 0, 1_000_000]],
    ["GuardAddStory", [3, 0, 0, 3, 1_000_000]],
    ["ExplorerCreateStory", [7, 3, 3, 0, 1_000_000, 0]],
    ["ExplorerCreateStory", [7, 3, 0, 3, 1_000_000, 0]],
    ["ExplorerCreateStory", [7, 3, 0, 0, 1_000_000, 6]],
  ] as const)("rejects invalid required enum values in %s", (name, payload) => {
    expect(() => decodedStory(name, [...payload])).toThrow("Invalid native enum");
  });
});
