import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const client = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const ticker = {
    tickCount: 0,
    start: vi.fn(),
    stop: vi.fn(),
  };

  return {
    client,
    ticker,
    createClient: vi.fn().mockResolvedValue(client),
    createGameAgent: vi.fn().mockReturnValue({
      agent: { state: { isStreaming: false }, subscribe: vi.fn(() => () => {}), prompt: vi.fn(), steer: vi.fn() },
      ticker,
      dispose: vi.fn().mockResolvedValue(undefined),
    }),
    createApp: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    getModel: vi.fn().mockReturnValue({ id: "test-model" }),
    loadConfig: vi.fn().mockReturnValue({
      rpcUrl: "http://rpc.local",
      toriiUrl: "http://torii.local",
      worldAddress: "0xworld",
      manifestPath: "./manifest.json",
      privateKey: "0xpk",
      accountAddress: "0xacc",
      tickIntervalMs: 1000,
      modelProvider: "anthropic",
      modelId: "claude-test",
      dataDir: "/tmp/agent-data",
    }),
    adapterCtor: vi.fn(),
    accountCtor: vi.fn(),
  };
});

vi.mock("@bibliothecadao/client", () => ({
  EternumClient: {
    create: mocks.createClient,
  },
}));

vi.mock("@mariozechner/pi-onchain-agent", () => ({
  createGameAgent: mocks.createGameAgent,
}));

vi.mock("@mariozechner/pi-ai", () => ({
  getModel: mocks.getModel,
}));

vi.mock("../src/config", () => ({
  loadConfig: mocks.loadConfig,
}));

vi.mock("../src/tui/app", () => ({
  createApp: mocks.createApp,
}));

vi.mock("../src/adapter/eternum-adapter", () => ({
  EternumGameAdapter: class {
    constructor(...args: unknown[]) {
      mocks.adapterCtor(...args);
    }
  },
}));

vi.mock("starknet", () => ({
  Account: class {
    constructor(opts: unknown) {
      mocks.accountCtor(opts);
      return { address: "0xacc" };
    }
  },
}));

describe("index bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue(mocks.client);
    mocks.createGameAgent.mockReturnValue({
      agent: { state: { isStreaming: false }, subscribe: vi.fn(() => () => {}), prompt: vi.fn(), steer: vi.fn() },
      ticker: mocks.ticker,
      dispose: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("does not auto-run main logic on module import", async () => {
    await import("../src/index");

    expect(mocks.loadConfig).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.ticker.start).not.toHaveBeenCalled();
  });

  it("exports loadManifest and main for direct testing", async () => {
    const mod = await import("../src/index");

    expect(typeof (mod as any).loadManifest).toBe("function");
    expect(typeof (mod as any).main).toBe("function");
  });

  it("loadManifest rejects invalid manifest shape", async () => {
    const dir = mkdtempSync(join(tmpdir(), "onchain-manifest-"));
      const manifestPath = join(dir, "manifest.json");
      writeFileSync(manifestPath, JSON.stringify({ world: {} }));

    try {
      const mod = await import("../src/index");
      await expect((mod as any).loadManifest(manifestPath)).rejects.toThrow("missing contracts[]");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("main wires startup and graceful shutdown", async () => {
    const dir = mkdtempSync(join(tmpdir(), "onchain-main-"));
    const manifestPath = join(dir, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({ contracts: [] }));

    const disposeAgent = vi.fn().mockResolvedValue(undefined);
    const disposeTui = vi.fn();
    mocks.createGameAgent.mockReturnValueOnce({
      agent: { state: { isStreaming: false }, subscribe: vi.fn(() => () => {}), prompt: vi.fn(), steer: vi.fn() },
      ticker: mocks.ticker,
      dispose: disposeAgent,
    });
    mocks.createApp.mockReturnValueOnce({ dispose: disposeTui });

    mocks.loadConfig.mockReturnValueOnce({
      rpcUrl: "http://rpc.local",
      toriiUrl: "http://torii.local",
      worldAddress: "0xworld",
      manifestPath,
      privateKey: "0xpk",
      accountAddress: "0xacc",
      tickIntervalMs: 1000,
      modelProvider: "anthropic",
      modelId: "claude-test",
      dataDir: "/tmp/agent-data",
    });

    const handlers: Record<string, (() => Promise<void>) | undefined> = {};
    const onSpy = vi.spyOn(process, "on").mockImplementation(((event: string, cb: () => Promise<void>) => {
      handlers[event] = cb;
      return process;
    }) as any);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      return undefined as never;
    }) as any);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const mod = await import("../src/index");
      await (mod as any).main();

      expect(mocks.createClient).toHaveBeenCalledWith({
        rpcUrl: "http://rpc.local",
        toriiUrl: "http://torii.local",
        worldAddress: "0xworld",
        manifest: { contracts: [] },
      });
      expect(mocks.client.connect).toHaveBeenCalledOnce();
      expect(mocks.ticker.start).toHaveBeenCalledOnce();
      expect(handlers.SIGINT).toBeTypeOf("function");
      expect(handlers.SIGTERM).toBeTypeOf("function");

      await handlers.SIGINT?.();

      expect(mocks.ticker.stop).toHaveBeenCalledOnce();
      expect(disposeAgent).toHaveBeenCalledOnce();
      expect(disposeTui).toHaveBeenCalledOnce();
      expect(mocks.client.disconnect).toHaveBeenCalledOnce();
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      logSpy.mockRestore();
      onSpy.mockRestore();
      exitSpy.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
