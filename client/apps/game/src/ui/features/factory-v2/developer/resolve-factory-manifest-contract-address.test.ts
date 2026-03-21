import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveFactoryManifestContractAddress } from "./resolve-factory-manifest-contract-address";

const mocks = vi.hoisted(() => ({
  getFactoryLookupManifest: vi.fn(),
  getFactorySqlBaseUrl: vi.fn(),
  listFactoryWorlds: vi.fn(),
  patchManifestWithFactory: vi.fn(),
  resolveWorldContracts: vi.fn(),
  resolveWorldDeploymentFromFactory: vi.fn(),
}));

vi.mock("./factory-manifest", () => ({
  getFactoryLookupManifest: mocks.getFactoryLookupManifest,
}));

vi.mock("@/runtime/world", () => ({
  getFactorySqlBaseUrl: mocks.getFactorySqlBaseUrl,
  listFactoryWorlds: mocks.listFactoryWorlds,
  patchManifestWithFactory: mocks.patchManifestWithFactory,
  resolveWorldContracts: mocks.resolveWorldContracts,
  resolveWorldDeploymentFromFactory: mocks.resolveWorldDeploymentFromFactory,
}));

describe("resolveFactoryManifestContractAddress", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getFactorySqlBaseUrl.mockReturnValue("https://factory.example/sql");
    mocks.listFactoryWorlds.mockResolvedValue([
      { name: "etrn-sunrise-01", chain: "slot", worldAddress: "0x111" },
      { name: "etrn-sunset-02", chain: "slot", worldAddress: "0x222" },
    ]);
    mocks.resolveWorldContracts.mockResolvedValue({ "0x1": "0xaaa" });
    mocks.resolveWorldDeploymentFromFactory.mockResolvedValue({ worldAddress: "0x111" });
    mocks.getFactoryLookupManifest.mockReturnValue({
      contracts: [{ tag: "s1_eternum-prize_distribution_systems", address: "0x0" }],
    });
    mocks.patchManifestWithFactory.mockImplementation((manifest: unknown) => ({
      ...(manifest as Record<string, unknown>),
      contracts: [{ tag: "s1_eternum-prize_distribution_systems", address: "0xabc" }],
    }));
  });

  it("resolves the default prize address tag", async () => {
    const result = await resolveFactoryManifestContractAddress({
      chain: "slot",
      worldName: "etrn-sunrise-01",
      manifestContractName: "s1_eternum-prize_distribution_systems",
    });

    expect(result).toEqual({
      kind: "success",
      worldName: "etrn-sunrise-01",
      resolvedTag: "s1_eternum-prize_distribution_systems",
      worldAddress: "0x111",
      contractAddress: "0xabc",
    });
    expect(mocks.resolveWorldContracts).toHaveBeenCalledWith("https://factory.example/sql", "etrn-sunrise-01");
    expect(mocks.resolveWorldDeploymentFromFactory).toHaveBeenCalledWith(
      "https://factory.example/sql",
      "etrn-sunrise-01",
    );
  });

  it("normalizes custom contract names before lookup", async () => {
    mocks.patchManifestWithFactory.mockReturnValue({
      contracts: [{ tag: "s1_eternum-prize_distribution_systems", address: "0xabc" }],
    });

    const result = await resolveFactoryManifestContractAddress({
      chain: "slot",
      worldName: "ETRN-SUNRISE-01",
      manifestContractName: "{prize_distribution_systems}",
    });

    expect(result).toMatchObject({
      kind: "success",
      resolvedTag: "s1_eternum-prize_distribution_systems",
    });
  });

  it("returns world suggestions when the world does not match exactly", async () => {
    const result = await resolveFactoryManifestContractAddress({
      chain: "slot",
      worldName: "etrn-sun",
      manifestContractName: "prize_distribution_systems",
    });

    expect(result).toEqual({
      kind: "failure",
      code: "world_not_found",
      message: 'No Factory world named "etrn-sun" was found on the selected chain.',
      worldSuggestions: ["etrn-sunrise-01", "etrn-sunset-02"],
    });
  });

  it("returns contract suggestions when the manifest tag is missing", async () => {
    mocks.patchManifestWithFactory.mockReturnValue({
      contracts: [
        { tag: "s1_eternum-prize_distribution_systems", address: "0xabc" },
        { tag: "s1_eternum-realm_systems", address: "0xdef" },
      ],
    });

    const result = await resolveFactoryManifestContractAddress({
      chain: "slot",
      worldName: "etrn-sunrise-01",
      manifestContractName: "resource_systems",
    });

    expect(result).toEqual({
      kind: "failure",
      code: "contract_not_found",
      message: 'No manifest contract matched "s1_eternum-resource_systems".',
      contractSuggestions: ["s1_eternum-prize_distribution_systems", "s1_eternum-realm_systems"],
    });
  });
});
