import { hash } from "starknet";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeHomeRing } from "./home-ring";
import { MadaraRpc } from "./madara-rpc";

describe("Madara RPC calls", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("encodes every call argument as a felt and decodes a home-ring reply", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: ["0x1", "0x0", "0x5", "0x6", "0x2"],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);

    const felts = await new MadaraRpc("http://madara.test").call("0xabc", "expedition_home_ring", ["42", 43n, 44], 7);

    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      jsonrpc: "2.0",
      id: 1,
      method: "starknet_call",
      params: [
        {
          contract_address: "0xabc",
          entry_point_selector: hash.getSelectorFromName("expedition_home_ring"),
          calldata: ["0x2a", "0x2b", "0x2c"],
        },
        { block_number: 7 },
      ],
    });
    expect(decodeHomeRing(felts)).toEqual([{ col: 5, row: 6, biome: 2 }]);
  });
});
