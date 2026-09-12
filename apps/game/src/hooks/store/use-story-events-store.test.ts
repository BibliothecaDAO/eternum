import { describe, expect, it } from "vitest";

import { toStreamStoryEvent } from "./use-story-events-store";

const scope = { chain: "madara", worldAddress: "0xabc", gameId: 54 };

describe("story event stream", () => {
  it("adapts a Herald StoryEvent to the existing presentation shape", () => {
    const event = toStreamStoryEvent(
      {
        hashed_keys: "0xstory",
        models: {
          StoryEvent: {
            game_id: "0x36",
            id: "0x7",
            owner: "0xabc",
            entity_id: "0x2a",
            tx_hash: "0xfeed",
            story: {
              BattleStory: {
                attacker_id: "0x2a",
                defender_id: "0x2b",
                winner_id: "0x2a",
                attacker_owner_address: "0xabc",
                defender_owner_address: "0xdef",
              },
            },
            timestamp: "0x64",
          },
        },
      },
      scope,
    );

    expect(event).toMatchObject({
      battle_attacker_id: "0x2a",
      battle_defender_id: "0x2b",
      battle_winner_id: "0x2a",
      entity_id: 42,
      event_id: "story:v1:madara:0xabc:0x36:0xfeed:0x7",
      owner: "0xabc",
      story: "BattleStory",
      timestamp: "0x64",
      tx_hash: "0xfeed",
    });
  });

  it("keeps the points-registered story out of the log; the leaderboard carries it", () => {
    const event = toStreamStoryEvent(
      {
        hashed_keys: "0x2",
        models: {
          StoryEvent: {
            owner: "0xabc",
            entity_id: "0x1",
            tx_hash: "0x9",
            story: { PointsRegisteredStory: { points: "0x64" } },
            timestamp: "0x64",
          },
        },
      },
      scope,
    );
    expect(event).toBeNull();
  });

  it("ignores non-story event models", () => {
    expect(toStreamStoryEvent({ hashed_keys: "0x1", models: { BattleEvent: {} } }, scope)).toBeNull();
  });
});
