import { expectedChainId } from "@realms-world/chain";
import { describe, expect, it } from "vitest";
import { assertRelayChainIds } from "./chains";

describe("operator chain guards", () => {
  it("accepts mainnet paired with the configured S2 chain", () => {
    expect(() => assertRelayChainIds(expectedChainId("mainnet"), expectedChainId("madara"), "madara")).not.toThrow();
  });

  it("rejects a mismatched S2 chain before either writer starts", () => {
    expect(() => assertRelayChainIds(expectedChainId("mainnet"), expectedChainId("appchain"), "madara")).toThrow(
      "S2_RPC_URL is not madara",
    );
  });
});
