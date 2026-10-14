import { beforeEach, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  imported: vi.fn(),
  create: vi.fn(),
  createFolder: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock("./graphics-gui", () => {
  runtime.imported();
  return { createGraphicsGuiRuntime: runtime.create };
});

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  runtime.create.mockReturnValue({ createFolder: runtime.createFolder, dispose: runtime.dispose });
});

async function loadManager(enabled: boolean) {
  vi.doMock("@/utils/dev-mode", () => ({ DEV_MODE_ENABLED: enabled }));
  return import("./gui-manager");
}

it("does not import or construct GUI code for normal entry", async () => {
  const manager = await loadManager(false);
  const lifetime = manager.createGraphicsGuiLifetime();
  await lifetime.ready;
  lifetime.dispose();
  expect(runtime.imported).not.toHaveBeenCalled();
  expect(runtime.create).not.toHaveBeenCalled();
});

it("initializes one debug root and disposes it exactly once", async () => {
  const manager = await loadManager(true);
  const lifetime = manager.createGraphicsGuiLifetime();
  await Promise.all([lifetime.ready, lifetime.ready]);
  const folder = { name: "HUD" };
  runtime.createFolder.mockReturnValue(folder);
  expect(manager.createGuiFolder("HUD")).toBe(folder);
  expect(runtime.createFolder).toHaveBeenCalledWith("HUD");
  expect(runtime.create).toHaveBeenCalledTimes(1);
  lifetime.dispose();
  lifetime.dispose();
  expect(runtime.dispose).toHaveBeenCalledTimes(1);
  expect(() => manager.createGuiFolder("HUD")).toThrow("Initialize the graphics GUI");
});

it("does not construct a debug root if its renderer is disposed during import", async () => {
  const manager = await loadManager(true);
  const lifetime = manager.createGraphicsGuiLifetime();
  lifetime.dispose();
  await lifetime.ready;
  expect(runtime.create).not.toHaveBeenCalled();
});
