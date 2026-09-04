import { beforeEach, describe, expect, it, vi } from "vitest";

describe("installHexGeometryPoolDebugHooks", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("installs hex-geometry debug hooks in DEV mode", async () => {
    vi.mock("@/three/constants", () => ({ HEX_SIZE: 1 }));
    vi.mock("@/three/geometry/hexagon-geometry", () => ({
      createHexagonShape: vi.fn(),
      createRoundedHexagonShape: vi.fn(),
    }));
    const { installHexGeometryPoolDebugHooks } = await import("./hex-geometry-pool");
    const target: Record<string, unknown> = {};

    installHexGeometryPoolDebugHooks({ target, isDev: true });

    expect(target.logHexGeometrySharing).toBeTypeOf("function");
    expect(target.getHexGeometryTypes).toBeTypeOf("function");
  });

  it("skips hex-geometry debug hooks outside DEV mode", async () => {
    vi.mock("@/three/constants", () => ({ HEX_SIZE: 1 }));
    vi.mock("@/three/geometry/hexagon-geometry", () => ({
      createHexagonShape: vi.fn(),
      createRoundedHexagonShape: vi.fn(),
    }));
    const { installHexGeometryPoolDebugHooks } = await import("./hex-geometry-pool");
    const target: Record<string, unknown> = {};

    installHexGeometryPoolDebugHooks({ target, isDev: false });

    expect(target.logHexGeometrySharing).toBeUndefined();
    expect(target.getHexGeometryTypes).toBeUndefined();
  });
});
