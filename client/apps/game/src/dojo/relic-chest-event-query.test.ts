// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { setGameScope } from "./game-scope";
import {
  buildOpenRelicChestEventQuery,
  decodeOpenRelicChestRelics,
  fetchOpenRelicChestEvent,
} from "./relic-chest-event-query";

afterEach(() => setGameScope("s1_eternum", 0));

describe("relic chest event history fallback", () => {
  it("builds the exact single-world event key", () => {
    expect(buildOpenRelicChestEventQuery(12, { x: -2, y: 4 })).toEqual(
      expect.objectContaining({
        clause: {
          Keys: {
            keys: ["0xc", "0x0", "0xfffffffe", "0x4"],
            pattern_matching: "VariableLen",
            models: ["s1_eternum-OpenRelicChestEvent"],
          },
        },
      }),
    );
  });

  it("prefixes the event key with the active appchain game", () => {
    setGameScope("s2", 13);

    expect(buildOpenRelicChestEventQuery(12, { x: 2, y: 4 }).clause).toEqual({
      Keys: {
        keys: ["0xd", "0xc", "0x0", "0x2", "0x4"],
        pattern_matching: "VariableLen",
        models: ["s2-OpenRelicChestEvent"],
      },
    });
  });

  it("reads and decodes the matching immutable event", async () => {
    const event = {
      explorer_id: 12,
      chest_coord: { x: 2, y: 4 },
      relics: [{ value: 1 }, 3],
    };
    const client = {
      getEventMessages: vi.fn(async () => ({
        items: [{ hashed_keys: "event", models: { "s1_eternum-OpenRelicChestEvent": event } }],
      })),
    };

    const result = await fetchOpenRelicChestEvent({
      client: client as never,
      explorerEntityId: 12,
      chestHex: { x: 2, y: 4 },
    });

    expect(decodeOpenRelicChestRelics(result!)).toEqual([1, 3]);
  });
});
