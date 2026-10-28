import { describe, expect, it } from "vitest";

import { resolveEndpoint } from "./endpoints";
import { isMainnetL2Rpc } from "./l2-rpc";

describe("isMainnetL2Rpc", () => {
  it("accepts the team's Alchemy app and Cartridge's public mainnet endpoint", () => {
    for (const url of [
      "https://starknet-mainnet.g.alchemy.com/v2/key",
      "https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_9/key",
      "https://api.cartridge.gg/x/starknet/mainnet",
    ])
      expect(isMainnetL2Rpc(url)).toBe(true);
  });

  it("refuses another network, another Cartridge path, another host and anything beyond the path", () => {
    for (const url of [
      undefined,
      "not a url",
      "https://starknet-sepolia.g.alchemy.com/v2/key",
      "https://starknet-mainnet.g.alchemy.com/",
      "https://api.cartridge.gg/x/starknet/sepolia",
      "https://api.cartridge.gg/x/starknet/mainnet/",
      "https://api.cartridge.gg/x/world",
      "https://evil.cartridge.gg/x/starknet/mainnet",
      "https://public-node.test/rpc",
      "http://api.cartridge.gg/x/starknet/mainnet",
      "https://api.cartridge.gg:8443/x/starknet/mainnet",
      "https://user:secret@api.cartridge.gg/x/starknet/mainnet",
      "https://api.cartridge.gg/x/starknet/mainnet?redirect=1",
      "https://api.cartridge.gg/x/starknet/mainnet#fragment",
    ])
      expect(isMainnetL2Rpc(url)).toBe(false);
  });

  it("leaves every other Cartridge endpoint refused", () => {
    expect(() =>
      resolveEndpoint("https://api.cartridge.gg/x/starknet/mainnet", {
        name: "Shard URL",
      }),
    ).toThrow("forbidden host");
  });
});
