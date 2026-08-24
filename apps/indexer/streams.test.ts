import { describe, expect, it } from "vitest";

import { getStarknetStreamUrl } from "./streams";

describe("Apibara Starknet stream configuration", () => {
  it("uses the current DNA stream hosts for supported networks", () => {
    expect(getStarknetStreamUrl("mainnet")).toBe(
      "https://mainnet.starknet.a5a.ch",
    );
    expect(getStarknetStreamUrl("sepolia")).toBe(
      "https://sepolia.starknet.a5a.ch",
    );
  });

  it("rejects unsupported networks instead of silently using mainnet", () => {
    expect(() => {
      Reflect.apply(getStarknetStreamUrl, undefined, ["local"]);
    }).toThrow("Unsupported Starknet stream network: local");
  });
});
