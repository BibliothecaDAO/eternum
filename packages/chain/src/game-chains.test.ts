import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { GAME_CHAIN_NAMES } from "./game-chains";

describe("game chain names", () => {
  it("matches the Madara node configuration", async () => {
    const config = await readFile(
      path.resolve(
        import.meta.dirname,
        "../../../deploy/madara-lab/chain-config.yaml",
      ),
      "utf8",
    );
    expect(config).toMatch(
      new RegExp(`^chain_id: [\"']${GAME_CHAIN_NAMES.madara}[\"']$`, "m"),
    );
  });

  it("is the source used by the appchain node configuration", async () => {
    const config = await readFile(
      path.resolve(
        import.meta.dirname,
        "../../../deploy/appchain/cdk/lib/config.ts",
      ),
      "utf8",
    );
    expect(config).toContain("chainId: GAME_CHAIN_NAMES.appchain");
  });
});
