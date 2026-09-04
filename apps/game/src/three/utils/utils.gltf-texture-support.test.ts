import { describe, expect, it, vi } from "vitest";

const loaderMocks = vi.hoisted(() => ({
  detectSupport: vi.fn(),
  setKTX2Loader: vi.fn(),
  setTranscoderPath: vi.fn(),
  setWorkerLimit: vi.fn(),
}));

vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: { getState: () => ({ account: { address: "0" } }) },
}));

vi.mock("three/addons/loaders/DRACOLoader.js", () => ({
  DRACOLoader: class {
    preload() {}
    setDecoderPath() {}
  },
}));

vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class {
    setDRACOLoader() {}
    setKTX2Loader(loader: unknown) {
      loaderMocks.setKTX2Loader(loader);
    }
    setMeshoptDecoder() {}
  },
}));

vi.mock("three/addons/loaders/KTX2Loader.js", () => ({
  KTX2Loader: class {
    detectSupport(renderer: unknown) {
      loaderMocks.detectSupport(renderer);
      return this;
    }
    setTranscoderPath(path: string) {
      loaderMocks.setTranscoderPath(path);
      return this;
    }
    setWorkerLimit(limit: number) {
      loaderMocks.setWorkerLimit(limit);
      return this;
    }
  },
}));

vi.mock("three/addons/libs/meshopt_decoder.module.js", () => ({ MeshoptDecoder: {} }));
vi.mock("@bibliothecadao/eternum", () => ({ calculateDistance: () => 0 }));
vi.mock("@bibliothecadao/types", () => ({ ContractAddress: (value: string) => value }));
vi.mock("../constants", () => ({ HEX_SIZE: 1 }));

const { configureGltfTextureSupport } = await import("./utils");

describe("glTF compressed texture support", () => {
  it("installs one local Basis transcoder and detects renderer support", () => {
    const renderer = { isWebGPURenderer: true };

    configureGltfTextureSupport(renderer as never);

    expect(loaderMocks.setTranscoderPath).toHaveBeenCalledWith("/basis-v2/");
    expect(loaderMocks.setWorkerLimit).toHaveBeenCalledWith(2);
    expect(loaderMocks.setKTX2Loader).toHaveBeenCalledTimes(1);
    expect(loaderMocks.detectSupport).toHaveBeenCalledWith(renderer);
  });
});
