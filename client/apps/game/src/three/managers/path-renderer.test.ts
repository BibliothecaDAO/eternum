// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const disposePathLineMaterialMock = vi.fn();

vi.mock("../geometry/path-geometry", () => ({
  createPathInstancedGeometry: vi.fn(),
  PathInstanceBuffers: class MockPathInstanceBuffers {
    dispose() {}
  },
}));

vi.mock("../shaders/path-line-material", () => ({
  getPathLineMaterial: vi.fn(),
  updatePathLineMaterial: vi.fn(),
  updatePathLineResolution: vi.fn(),
  disposePathLineMaterial: disposePathLineMaterialMock,
  updatePathLineProgress: vi.fn(),
}));

vi.mock("../utils/centralized-visibility-manager", () => ({
  getVisibilityManager: vi.fn(() => ({
    isBoxVisible: vi.fn(() => true),
  })),
}));

const { PathRenderer } = await import("./path-renderer");

function createPathRendererSubject() {
  const subject = Object.create(PathRenderer.prototype) as any;
  const clearAll = vi.fn();
  const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
  const resizeHandler = vi.fn();
  const parentRemove = vi.fn();
  const geometryDispose = vi.fn();
  const buffersDispose = vi.fn();

  subject.clearAll = clearAll;
  subject.resizeHandler = resizeHandler;
  subject.mesh = {
    parent: {
      remove: parentRemove,
    },
    geometry: {
      dispose: geometryDispose,
    },
  };
  subject.buffers = {
    dispose: buffersDispose,
  };
  subject.scene = {} as any;

  (PathRenderer as any).instance = subject;

  return {
    subject,
    clearAll,
    removeEventListenerSpy,
    resizeHandler,
    parentRemove,
    geometryDispose,
    buffersDispose,
  };
}

describe("PathRenderer lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("disposes mesh/listeners/materials/buffers and resets singleton instance", () => {
    const fixture = createPathRendererSubject();

    fixture.subject.dispose();

    expect(fixture.clearAll).toHaveBeenCalledTimes(1);
    expect(fixture.removeEventListenerSpy).toHaveBeenCalledWith("resize", fixture.resizeHandler);
    expect(fixture.subject.resizeHandler).toBeNull();
    expect(fixture.parentRemove).toHaveBeenCalledTimes(1);
    expect(fixture.geometryDispose).toHaveBeenCalledTimes(1);
    expect(fixture.subject.mesh).toBeNull();
    expect(disposePathLineMaterialMock).toHaveBeenCalledTimes(1);
    expect(fixture.buffersDispose).toHaveBeenCalledTimes(1);
    expect(fixture.subject.scene).toBeNull();
    expect((PathRenderer as any).instance).toBeNull();
  });

  it("is idempotent and skips duplicate dispose work", () => {
    const fixture = createPathRendererSubject();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    fixture.subject.dispose();
    fixture.subject.dispose();

    expect(fixture.clearAll).toHaveBeenCalledTimes(1);
    expect(disposePathLineMaterialMock).toHaveBeenCalledTimes(1);
    expect(fixture.buffersDispose).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("PathRenderer already disposed, skipping cleanup");
  });
});
