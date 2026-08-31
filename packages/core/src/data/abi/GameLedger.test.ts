import { describe, expect, it } from "vitest";
import { decodeGameLedgerGame } from "./GameLedger";

describe("GameLedger ABI", () => {
  it("decodes the complete get_game tuple from the vendored field order", () => {
    expect(
      decodeGameLedgerGame(["0x1", "0x2", "0x3", "0x4", "0x5", "0x1", "0x6", "0x0", "0x1", "0x7", "0x2", "0x8", "0x3"]),
    ).toEqual({
      cancelled: false,
      dust: 8n + (3n << 128n),
      end: 4,
      exists: true,
      finalized: true,
      pool: 5n + (1n << 128n),
      presetId: 2,
      protocolCut: 7n + (2n << 128n),
      registeredCount: 6,
      start: 3,
    });
  });

  it("fails loudly when the returned ABI shape drifts", () => {
    expect(() => decodeGameLedgerGame(["0x1"])).toThrow("returned 1 felts; expected 13");
  });
});
