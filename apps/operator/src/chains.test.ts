import { GAME_CHAIN_NAMES } from "@realms-world/chain";
import { constants, shortString } from "starknet";
import { describe, expect, it } from "vitest";
import { assertRelayChainIds } from "./chains";

describe("operator chain guards", () => {
  it("accepts mainnet paired with the configured S2 chain", () => {
    expect(() =>
      assertRelayChainIds(
        constants.StarknetChainId.SN_MAIN,
        shortString.encodeShortString(GAME_CHAIN_NAMES.madara),
        "madara",
      ),
    ).not.toThrow();
  });

  it("rejects a mismatched S2 chain before either writer starts", () => {
    expect(() =>
      assertRelayChainIds(
        constants.StarknetChainId.SN_MAIN,
        shortString.encodeShortString(GAME_CHAIN_NAMES.appchain),
        "madara",
      ),
    ).toThrow("S2_RPC_URL is not madara");
  });
});
