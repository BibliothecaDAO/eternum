import { describe, expect, it } from "vitest";
import { assertRelayChainIds } from "./chains";

describe("operator chain guards", () => {
  it("accepts mainnet paired with the configured S2 chain", () => {
    expect(() =>
      assertRelayChainIds("0x534e5f4d41494e", "0x57505f5245414c4d535f4d41444152415f4c4142", "madara"),
    ).not.toThrow();
  });

  it("rejects a mismatched S2 chain before either writer starts", () => {
    expect(() => assertRelayChainIds("0x534e5f4d41494e", "0x57505f5245414c4d535f444556", "madara")).toThrow(
      "S2_RPC_URL is not madara",
    );
  });
});
