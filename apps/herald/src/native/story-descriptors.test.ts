import { buildStoryEventPresentation } from "@bibliothecadao/eternum";
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
  const layout = schema.domains.troops.events.find((event) => event.name === "StoryEvent")!;
  const decoded = setup().decoder.decode(
    raw({
      from_address: manifest.native.domains.troops.address,
      keys: [...layout.prefix, "1", "1", "100", "0", "0x123", "0", "3", "0x55"],
      data: [String(variant), ...payload.map(String), "140"],
    }),
  );
  if (decoded.kind !== "event") throw new Error("Expected story event");
  const value = toJsonValue(decoded.value) as { story: Record<string, Record<string, unknown>> };
  return value.story[name];
}

function renderedStory(storyType: string, payload: number[]) {
  const storyPayload = decodedStory(storyType, payload);
  return buildStoryEventPresentation({
    storyType,
    storyPayload,
    ownerAddress: "0x123",
    ownerName: null,
    entityId: null,
    txHash: "0x55",
    timestamp: 140,
    rawStory: { [storyType]: storyPayload },
  }).description;
}

describe("compiled native story descriptors", () => {
  for (const [category, categoryName] of categories.entries()) {
    for (const [tier, tierName] of tiers.entries()) {
      for (const [slot, slotName] of slots.entries()) {
        it(`renders ${tierName} ${categoryName} in ${slotName}`, () => {
          const description = renderedStory("GuardAddStory", [3, slot, category, tier, 1_000_000]);
          expect(description).toContain(`Unit: ${categoryName} ${tierName}`);
          expect(description).toContain(`Assignment: ${slotName}`);
        });
      }
      for (const [direction, directionName] of directions.entries()) {
        it(`renders ${tierName} ${categoryName} spawning ${directionName}`, () => {
          const description = renderedStory("ExplorerCreateStory", [7, 3, category, tier, 1_000_000, direction]);
          expect(description).toContain(`Unit: ${categoryName} ${tierName}`);
          expect(description).toContain(`Spawn: ${directionName}`);
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
