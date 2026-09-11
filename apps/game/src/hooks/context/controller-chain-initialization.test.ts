import ControllerProvider from "@cartridge/controller";
import { constants } from "starknet";
import { afterEach, describe, expect, it, vi } from "vitest";

const mainnet = constants.StarknetChainId.SN_MAIN;
const rpcUrl = "https://identity-rpc.realms.test/";

function initializeChains(chains: Array<{ rpcUrl: string; chainId?: string }>) {
  // Exercise the installed SDK's initializer without registering a wallet or creating an iframe.
  const provider = { chains: new Map(), selectedChain: mainnet };
  Reflect.get(ControllerProvider.prototype, "initializeChains").call(provider, chains);
  return provider.chains;
}

afterEach(() => vi.unstubAllGlobals());

describe("Controller chain initialization", () => {
  it("initializes a known identity chain even when RPC discovery is unavailable", () => {
    const request = vi.fn(() => {
      throw new Error("RPC unavailable");
    });
    vi.stubGlobal("XMLHttpRequest", request);

    const chain = { rpcUrl, chainId: mainnet };
    expect(initializeChains([chain]).get(mainnet)).toBe(chain);
    expect(request).not.toHaveBeenCalled();
  });

  it("preserves discovery for callers that do not specify a chain ID", () => {
    const open = vi.fn();
    const send = vi.fn();
    vi.stubGlobal(
      "XMLHttpRequest",
      class {
        open = open;
        send = send;
        setRequestHeader = vi.fn();
        status = 200;
        responseText = JSON.stringify({ result: mainnet });
      },
    );

    const chain = { rpcUrl };
    expect(initializeChains([chain]).get(mainnet)).toBe(chain);
    expect(open).toHaveBeenCalledWith("POST", rpcUrl, false);
    expect(JSON.parse(send.mock.calls[0][0]).method).toBe("starknet_chainId");
  });
});
