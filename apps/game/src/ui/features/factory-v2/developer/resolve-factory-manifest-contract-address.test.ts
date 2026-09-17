import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveFactoryManifestContractAddress } from "./resolve-factory-manifest-contract-address";

const mocks = vi.hoisted(() => ({
  getNativeManifest: vi.fn(),
  getWorldById: vi.fn(),
  resolveWorldIdForGame: vi.fn(),
}));

vi.mock("@/runtime/world/native-manifest", () => ({
  getNativeManifest: mocks.getNativeManifest,
}));

vi.mock("@bibliothecadao/eternum/game-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum/game-client")>()),
  resolveWorldIdForGame: mocks.resolveWorldIdForGame,
}));

vi.mock("@/runtime/world/world-directory", () => ({
  getWorldById: mocks.getWorldById,
}));

describe("resolveFactoryManifestContractAddress", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.resolveWorldIdForGame.mockResolvedValue("blitz");
    mocks.getWorldById.mockReturnValue({ id: "blitz", chain: "appchain", worldAddress: "0x111" });
    mocks.getNativeManifest.mockReturnValue({
      world: { address: "0x111" },
      contracts: [{ tag: "native-prizes", address: "0xabc" }],
    });
  });

  it("resolves the default prize address tag", async () => {
    const result = await resolveFactoryManifestContractAddress({
      chain: "appchain",
      worldName: "etrn-sunrise-01",
      manifestContractName: "native-prizes",
    });

    expect(result).toEqual({
      kind: "success",
      worldName: "etrn-sunrise-01",
      resolvedTag: "native-prizes",
      worldAddress: "0x111",
      contractAddress: "0xabc",
    });
    expect(mocks.resolveWorldIdForGame).toHaveBeenCalledWith("etrn-sunrise-01");
    expect(mocks.getNativeManifest).toHaveBeenCalledWith();
  });

  it("normalizes custom contract names before lookup", async () => {
    const result = await resolveFactoryManifestContractAddress({
      chain: "appchain",
      worldName: "ETRN-SUNRISE-01",
      manifestContractName: "{prizes}",
    });

    expect(result).toMatchObject({
      kind: "success",
      resolvedTag: "native-prizes",
    });
  });

  it("reports a game missing from the committed world registries", async () => {
    mocks.resolveWorldIdForGame.mockResolvedValue(null);
    mocks.getWorldById.mockReturnValue(null);

    const result = await resolveFactoryManifestContractAddress({
      chain: "appchain",
      worldName: "etrn-sun",
      manifestContractName: "prizes",
    });

    expect(result).toEqual({
      kind: "failure",
      code: "factory_unavailable",
      message: 'Game "etrn-sun" was not found in any deployed world\'s registry.',
    });
  });

  it("returns contract suggestions when the manifest tag is missing", async () => {
    mocks.getNativeManifest.mockReturnValue({
      world: { address: "0x111" },
      contracts: [
        { tag: "native-prizes", address: "0xabc" },
        { tag: "native-structures", address: "0xdef" },
      ],
    });

    const result = await resolveFactoryManifestContractAddress({
      chain: "appchain",
      worldName: "etrn-sunrise-01",
      manifestContractName: "resources",
    });

    expect(result).toEqual({
      kind: "failure",
      code: "contract_not_found",
      message: 'No manifest contract matched "native-resources".',
      contractSuggestions: ["native-prizes", "native-structures"],
    });
  });
});
