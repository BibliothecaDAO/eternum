import { beforeEach, describe, expect, it, vi } from "vitest";

const viewerMock = vi.fn<() => bigint | null>();

vi.mock("@/hooks/store/use-account-store", () => ({ accountAddress: () => viewerMock() }));

vi.mock("three/addons/loaders/DRACOLoader.js", () => ({
  DRACOLoader: class {
    setDecoderPath() {}
    preload() {}
  },
}));

vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class {
    setDRACOLoader() {}
    setKTX2Loader() {}
    setMeshoptDecoder() {}
  },
}));

vi.mock("three/addons/loaders/KTX2Loader.js", () => ({
  KTX2Loader: class {
    detectSupport() {}
    setTranscoderPath() {
      return this;
    }
    setWorkerLimit() {
      return this;
    }
  },
}));

vi.mock("three/addons/libs/meshopt_decoder.module.js", () => ({ MeshoptDecoder: {} }));

vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  isViewerOwner: (await importOriginal<typeof import("@bibliothecadao/eternum")>()).isViewerOwner,
  calculateDistance: () => 0,
}));

vi.mock("../constants", () => ({
  HEX_SIZE: 1,
}));

import { isAddressEqualToAccount } from "./utils";

describe("isAddressEqualToAccount", () => {
  beforeEach(() => {
    viewerMock.mockReset();
    viewerMock.mockReturnValue(123n);
  });

  it("matches bigint and string addresses", () => {
    expect(isAddressEqualToAccount(123n)).toBe(true);
    expect(isAddressEqualToAccount("123")).toBe(true);
    expect(isAddressEqualToAccount(" 123 ")).toBe(true);
    expect(isAddressEqualToAccount("0x7b")).toBe(true);
  });

  it("returns false for invalid or empty string addresses", () => {
    expect(isAddressEqualToAccount("")).toBe(false);
    expect(isAddressEqualToAccount("   ")).toBe(false);
    expect(isAddressEqualToAccount("not-an-address")).toBe(false);
  });

  it("returns false for nullish values", () => {
    expect(isAddressEqualToAccount(null)).toBe(false);
    expect(isAddressEqualToAccount(undefined)).toBe(false);
  });

  it("matches nothing without a viewer, the zero address included", () => {
    viewerMock.mockReturnValue(null);
    expect(isAddressEqualToAccount(0n)).toBe(false);
    expect(isAddressEqualToAccount("0x0")).toBe(false);
  });

  it("returns false if a numeric value is passed at runtime", () => {
    expect(isAddressEqualToAccount(123 as unknown as bigint)).toBe(false);
  });
});
