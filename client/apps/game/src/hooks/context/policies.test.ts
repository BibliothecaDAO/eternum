import { beforeEach, describe, expect, it, vi } from "vitest";

const { getActiveWorldMock } = vi.hoisted(() => ({
  getActiveWorldMock: vi.fn(),
}));

vi.mock("@/runtime/world", () => ({
  getActiveWorld: getActiveWorldMock,
}));

vi.mock("@cartridge/controller", () => ({
  toSessionPolicies: vi.fn((value) => value),
}));

vi.mock("@dojoengine/core", () => ({
  getContractByName: vi.fn((_: unknown, __: string, contractName: string) => ({
    address: `0x${contractName}`,
  })),
}));

vi.mock("@/utils/addresses", () => ({
  getSeasonPassAddress: vi.fn(() => "0xseasonpass"),
  getVillagePassAddress: vi.fn(() => "0xvillagepass"),
}));

vi.mock("../../../dojo-config", () => ({
  dojoConfig: {
    manifest: {},
  },
}));

vi.mock("../../../env", () => ({
  env: {
    VITE_PUBLIC_ENTRY_TOKEN_ADDRESS: "0xenventry",
    VITE_PUBLIC_FEE_TOKEN_ADDRESS: "0xenvfee",
  },
}));

import { buildPolicies } from "./policies";

describe("buildPolicies", () => {
  beforeEach(() => {
    getActiveWorldMock.mockReset();
  });

  it("re-reads active world token addresses each time policies are built", () => {
    getActiveWorldMock.mockReturnValueOnce({
      entryTokenAddress: "0xentryone",
      feeTokenAddress: "0xfeeone",
    });

    const first = buildPolicies({});
    expect(first.contracts).toHaveProperty("0xentryone");
    expect(first.contracts).toHaveProperty("0xfeeone");

    getActiveWorldMock.mockReturnValueOnce({
      entryTokenAddress: "0xentrytwo",
      feeTokenAddress: "0xfeetwo",
    });

    const second = buildPolicies({});
    expect(second.contracts).toHaveProperty("0xentrytwo");
    expect(second.contracts).toHaveProperty("0xfeetwo");
  });
});
