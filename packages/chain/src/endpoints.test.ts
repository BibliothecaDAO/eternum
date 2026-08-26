import { describe, expect, it } from "vitest";

import { isGameChain, resolveEndpoint } from "./endpoints";

describe("resolveEndpoint", () => {
  it("accepts owned HTTPS endpoints", () => {
    expect(
      resolveEndpoint("https://rpc.realms.test/", {
        name: "RPC_URL",
        browserFacing: true,
        locationProtocol: "https:",
      }),
    ).toBe("https://rpc.realms.test");
  });

  it("rejects missing and forbidden endpoints", () => {
    const forbiddenUrl = `https://api.${["cartridge", "gg"].join(".")}/x/world`;
    expect(() => resolveEndpoint(undefined, { name: "RPC_URL" })).toThrow(
      "RPC_URL is required",
    );
    expect(() => resolveEndpoint(forbiddenUrl, { name: "RPC_URL" })).toThrow(
      "forbidden host",
    );
  });

  it("rejects mixed content only for browser traffic", () => {
    expect(() =>
      resolveEndpoint("http://127.0.0.1:5060", {
        name: "RPC_URL",
        browserFacing: true,
        locationProtocol: "https:",
      }),
    ).toThrow("must use HTTPS");

    expect(
      resolveEndpoint("http://127.0.0.1:5060", {
        name: "RPC_URL",
        browserFacing: false,
        locationProtocol: "https:",
      }),
    ).toBe("http://127.0.0.1:5060");
  });
});

describe("isGameChain", () => {
  it("accepts only the two phase-one game chains", () => {
    expect(isGameChain("madara")).toBe(true);
    expect(isGameChain("appchain")).toBe(true);
    expect(isGameChain("local")).toBe(false);
    expect(isGameChain("mainnet")).toBe(false);
  });
});
