// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const applyAuthoritativeEntities = vi.hoisted(() => vi.fn());

vi.mock("@bibliothecadao/eternum/game-sync", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum/game-sync")>()),
  requireActiveGameSyncRuntime: () => ({ applyAuthoritativeEntities }),
}));

import { setGameScope } from "./game-scope";
import { getEntitiesFromTorii } from "./queries";

describe("targeted Torii query ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setGameScope("s2", 15);
  });

  afterEach(() => setGameScope("s1_eternum", 0));

  it("routes wrapped query results through the active sync runtime", async () => {
    const wrappedEntity = {
      hashed_keys: "0xarmy",
      models: {
        "s2-ExplorerTroops": {
          explorer_id: { key: true, type: "primitive", type_name: "u32", value: "10775" },
        },
      },
    };
    const client = {
      getEntities: vi.fn(async () => ({ items: [wrappedEntity], next_cursor: undefined })),
    };

    await getEntitiesFromTorii(client as never, [10775], ["s2-ExplorerTroops"]);

    expect(applyAuthoritativeEntities).toHaveBeenCalledWith([wrappedEntity]);
    expect(client.getEntities).toHaveBeenCalledWith(
      expect.objectContaining({
        clause: {
          Keys: {
            // Keys must be hex: a decimal id string does not survive the grpc
            // key encoding and matches nothing (10775 = 0x2a17).
            keys: ["0xf", "0x2a17"],
            pattern_matching: "VariableLen",
            models: [],
          },
        },
        models: ["s2-ExplorerTroops"],
      }),
    );
  });
});
