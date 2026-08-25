// @vitest-environment node
import { describe, expect, it } from "vitest";

import { resolveRegistrationCosmeticTokenIds } from "./registration-cosmetic-token-ids";

describe("resolveRegistrationCosmeticTokenIds", () => {
  it("rejects preview-only synthetic cosmetic selections for onchain registration", () => {
    expect(() =>
      resolveRegistrationCosmeticTokenIds({
        draft: {
          tokenIds: ["preview:0x107050201"],
          selectedBySlot: {
            armor: {
              tokenId: "preview:0x107050201",
              cosmeticIds: ["army:Knight:T3:legacy"],
            },
          },
        },
        maxSelections: 8,
      }),
    ).toThrow("Preview-only cosmetics cannot be registered onchain");
  });

  it("returns real token ids unchanged for normal registration", () => {
    expect(
      resolveRegistrationCosmeticTokenIds({
        draft: {
          tokenIds: ["0xabc"],
          selectedBySlot: {
            armor: {
              tokenId: "0xabc",
              cosmeticIds: ["army:Knight:T3:legacy"],
            },
          },
        },
        maxSelections: 8,
      }),
    ).toEqual(["0xabc"]);
  });
});
