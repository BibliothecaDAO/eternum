import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveFactoryManifestContractAddress } from "./resolve-factory-manifest-contract-address";

const mocks = vi.hoisted(() => ({
  getGameManifest: vi.fn(),
  getWorldById: vi.fn(),
  resolveWorldIdForGame: vi.fn(),
}));

vi.mock("@contracts", () => ({
  getGameManifest: mocks.getGameManifest,
}));

vi.mock("@/runtime/world/game-registry", () => ({
  resolveWorldIdForGame: mocks.resolveWorldIdForGame,
}));

vi.mock("@/runtime/world/world-directory", () => ({
  getWorldById: mocks.getWorldById,
}));

describe("resolveFactoryManifestContractAddress", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.resolveWorldIdForGame.mockResolvedValue("blitz");
    mocks.getWorldById.mockReturnValue({ id: "blitz", worldAddress: "0x111" });
    mocks.getGameManifest.mockReturnValue({
      contracts: [{ tag: "s2-prize_distribution_systems", address: "0xabc" }],
    });
  });

  it("resolves the default prize address tag", async () => {
    const result = await resolveFactoryManifestContractAddress({
      chain: "appchain",
      worldName: "etrn-sunrise-01",
      manifestContractName: "s2-prize_distribution_systems",
    });

    expect(result).toEqual({
      kind: "success",
      worldName: "etrn-sunrise-01",
      resolvedTag: "s2-prize_distribution_systems",
      worldAddress: "0x111",
      contractAddress: "0xabc",
    });
    expect(mocks.resolveWorldIdForGame).toHaveBeenCalledWith("etrn-sunrise-01");
    expect(mocks.getGameManifest).toHaveBeenCalledWith("appchain", "blitz");
  });

  it("normalizes custom contract names before lookup", async () => {
    const result = await resolveFactoryManifestContractAddress({
      chain: "appchain",
      worldName: "ETRN-SUNRISE-01",
      manifestContractName: "{prize_distribution_systems}",
    });

    expect(result).toMatchObject({
      kind: "success",
      resolvedTag: "s2-prize_distribution_systems",
    });
  });

  it("reports a game missing from the committed world registries", async () => {
    mocks.resolveWorldIdForGame.mockResolvedValue(null);
    mocks.getWorldById.mockReturnValue(null);

    const result = await resolveFactoryManifestContractAddress({
      chain: "appchain",
      worldName: "etrn-sun",
      manifestContractName: "prize_distribution_systems",
    });

    expect(result).toEqual({
      kind: "failure",
      code: "factory_unavailable",
      message: 'Game "etrn-sun" was not found in any deployed world\'s registry.',
    });
  });

  it("returns contract suggestions when the manifest tag is missing", async () => {
    mocks.getGameManifest.mockReturnValue({
      contracts: [
        { tag: "s2-prize_distribution_systems", address: "0xabc" },
        { tag: "s2-realm_systems", address: "0xdef" },
      ],
    });

    const result = await resolveFactoryManifestContractAddress({
      chain: "appchain",
      worldName: "etrn-sunrise-01",
      manifestContractName: "resource_systems",
    });

    expect(result).toEqual({
      kind: "failure",
      code: "contract_not_found",
      message: 'No manifest contract matched "s2-resource_systems".',
      contractSuggestions: ["s2-prize_distribution_systems", "s2-realm_systems"],
    });
  });
});
