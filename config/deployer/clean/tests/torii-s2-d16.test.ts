import { describe, expect, test } from "bun:test";
import { buildD16Clauses } from "../../../../deploy/appchain/torii-s2/d16-verify";

describe("single-world s2 Torii clauses", () => {
  test("pins the exact key, member, and player-composite payloads", () => {
    const player = "0x123";

    expect(buildD16Clauses(7, player)).toEqual({
      keys: {
        Keys: {
          keys: ["0x7"],
          pattern_matching: "VariableLen",
          models: ["s2-GameRegistry"],
        },
      },
      member: {
        Member: {
          model: "s2-GameRegistry",
          member: "game_id",
          operator: "Eq",
          value: { Primitive: { U32: 7 } },
        },
      },
      composite: {
        Composite: {
          operator: "And",
          clauses: [
            {
              Keys: {
                keys: ["0x7"],
                pattern_matching: "VariableLen",
                models: ["s2-GameRegistry"],
              },
            },
            {
              Member: {
                model: "s2-GameRegistry",
                member: "creator",
                operator: "Eq",
                value: {
                  Primitive: {
                    ContractAddress: `0x${"123".padStart(64, "0")}`,
                  },
                },
              },
            },
          ],
        },
      },
    });
  });
});
