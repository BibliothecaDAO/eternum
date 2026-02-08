import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
    setIntervalMs: vi.fn(),
    intervalMs: 1000,
  };

  const heartbeatLoop = {
    start: vi.fn(),
    stop: vi.fn(),
    setPollIntervalMs: vi.fn(),
    pollIntervalMs: 15000,
    isRunning: false,
    cycleCount: 0,
  };

  const agent = {
    state: { isStreaming: false },
    subscribe: vi.fn(() => () => {}),
    prompt: vi.fn(),
    steer: vi.fn(),
    setModel: vi.fn(),
    setThinkingLevel: vi.fn(),
  };

  const sessionInstances: Array<{
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    config: unknown;
  }> = [];

  return {
    client,
    ticker,
    createClient: vi.fn().mockResolvedValue(client),
    createGameAgent: vi.fn().mockReturnValue({
      agent,
      ticker,
      enqueuePrompt: vi.fn().mockResolvedValue(undefined),
      setDataDir: vi.fn(),
      getDataDir: vi.fn().mockReturnValue("/tmp/agent-data"),
      dispose: vi.fn().mockResolvedValue(undefined),
    }),
    createHeartbeatLoop: vi.fn().mockReturnValue(heartbeatLoop),
    createApp: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    getModel: vi.fn().mockReturnValue({ id: "test-model" }),
    loadConfig: vi.fn().mockReturnValue({
      rpcUrl: "http://rpc.local",
      toriiUrl: "http://torii.local",
      worldAddress: "0xworld",
      manifestPath: "./manifest.json",
      chainId: "SN_SEPOLIA",
      sessionBasePath: ".cartridge",
      tickIntervalMs: 1000,
      loopEnabled: true,
      modelProvider: "anthropic",
      modelId: "claude-test",
      gameName: "eternum",
      dataDir: "/tmp/agent-data",
    }),
    adapterCtor: vi.fn(),
    agent,
    heartbeatLoop,
    sessionInstances,
  };
});

vi.mock("@bibliothecadao/client", () => ({
  EternumClient: {
    create: mocks.createClient,
  },
}));

vi.mock("@bibliothecadao/game-agent", () => ({
  createGameAgent: mocks.createGameAgent,
  createHeartbeatLoop: mocks.createHeartbeatLoop,
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

vi.mock("../src/session", () => ({
  ControllerSession: class {
    connect = vi.fn().mockResolvedValue({ address: "0xsession" });
    disconnect = vi.fn().mockResolvedValue(undefined);

    constructor(config: unknown) {
      mocks.sessionInstances.push({
        connect: this.connect,
        disconnect: this.disconnect,
        config,
      });
    }
  },
}));

describe("index bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.sessionInstances.length = 0;
    mocks.createClient.mockResolvedValue(mocks.client);
    mocks.createHeartbeatLoop.mockReturnValue(mocks.heartbeatLoop);
    mocks.createApp.mockReturnValue({ dispose: vi.fn() });
    mocks.getModel.mockReturnValue({ id: "test-model" });
    mocks.createGameAgent.mockReturnValue({
      agent: mocks.agent,
      ticker: mocks.ticker,
      enqueuePrompt: vi.fn().mockResolvedValue(undefined),
      setDataDir: vi.fn(),
      getDataDir: vi.fn().mockReturnValue("/tmp/agent-data"),
      dispose: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("main wires startup and graceful shutdown without revoking the persisted session", async () => {
    const dir = mkdtempSync(join(tmpdir(), "onchain-main-"));
    const manifestPath = join(dir, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({ contracts: [] }));

    const disposeAgent = vi.fn().mockResolvedValue(undefined);
    const disposeTui = vi.fn();
    mocks.createGameAgent.mockReturnValueOnce({
      agent: mocks.agent,
      ticker: mocks.ticker,
      enqueuePrompt: vi.fn().mockResolvedValue(undefined),
      setDataDir: vi.fn(),
      getDataDir: vi.fn().mockReturnValue("/tmp/agent-data"),
      dispose: disposeAgent,
    });
    mocks.createApp.mockReturnValueOnce({ dispose: disposeTui });

    mocks.loadConfig.mockReturnValueOnce({
      rpcUrl: "http://rpc.local",
      toriiUrl: "http://torii.local",
      worldAddress: "0xworld",
      manifestPath,
      chainId: "SN_SEPOLIA",
      sessionBasePath: ".cartridge",
      tickIntervalMs: 1000,
      loopEnabled: true,
      modelProvider: "anthropic",
      modelId: "claude-test",
      gameName: "eternum",
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

      expect(mocks.sessionInstances).toHaveLength(1);
      expect(mocks.sessionInstances[0]?.connect).toHaveBeenCalledOnce();
      expect((mocks.sessionInstances[0]?.config as any)?.gameName).toBe("eternum");
      expect(mocks.createClient).toHaveBeenCalledWith({
        rpcUrl: "http://rpc.local",
        toriiUrl: "http://torii.local",
        worldAddress: "0xworld",
        manifest: { contracts: [] },
      });
      expect(mocks.client.connect).toHaveBeenCalledOnce();
      expect(mocks.ticker.start).toHaveBeenCalledOnce();
      expect(mocks.heartbeatLoop.start).toHaveBeenCalledOnce();

      const heartbeatConfig = mocks.createHeartbeatLoop.mock.calls[0]?.[0];
      expect(typeof heartbeatConfig?.onRun).toBe("function");
      const enqueuePrompt = mocks.createGameAgent.mock.results[0]?.value?.enqueuePrompt;
      await heartbeatConfig.onRun({
        id: "market-check",
        enabled: true,
        schedule: "*/10 * * * *",
        mode: "observe",
        prompt: "Check market conditions",
      });
      expect(enqueuePrompt).toHaveBeenCalled();

      expect(handlers.SIGINT).toBeTypeOf("function");
      expect(handlers.SIGTERM).toBeTypeOf("function");

      await handlers.SIGINT?.();

      expect(mocks.ticker.stop).toHaveBeenCalledOnce();
      expect(mocks.heartbeatLoop.stop).toHaveBeenCalledOnce();
      expect(disposeAgent).toHaveBeenCalledOnce();
      expect(disposeTui).toHaveBeenCalledOnce();
      expect(mocks.client.disconnect).toHaveBeenCalledOnce();
      expect(mocks.sessionInstances[0]?.disconnect).not.toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      logSpy.mockRestore();
      onSpy.mockRestore();
      exitSpy.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exposes live runtime config updates through runtimeConfigManager without restarting process", async () => {
    const dir = mkdtempSync(join(tmpdir(), "onchain-live-config-"));
    const manifestPath = join(dir, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({ contracts: [] }));

    mocks.loadConfig.mockReturnValueOnce({
      rpcUrl: "http://rpc.local",
      toriiUrl: "http://torii.local",
      worldAddress: "0xworld",
      manifestPath,
      chainId: "SN_SEPOLIA",
      sessionBasePath: ".cartridge",
      tickIntervalMs: 1000,
      loopEnabled: true,
      modelProvider: "anthropic",
      modelId: "claude-test",
      gameName: "eternum",
      dataDir: "/tmp/agent-data",
    });

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      return undefined as never;
    }) as any);
    const onSpy = vi.spyOn(process, "on").mockImplementation(((event: string, cb: () => Promise<void>) => {
      return process;
    }) as any);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const mod = await import("../src/index");
      await (mod as any).main();

      const gameAgentCall = mocks.createGameAgent.mock.calls[0]?.[0];
      expect(gameAgentCall?.runtimeConfigManager).toBeDefined();
      expect(mocks.createHeartbeatLoop).toHaveBeenCalledOnce();

      await gameAgentCall.runtimeConfigManager.applyChanges([{ path: "tickIntervalMs", value: 2500 }], "test");
      expect(mocks.ticker.setIntervalMs).toHaveBeenCalledWith(2500);

      await gameAgentCall.runtimeConfigManager.applyChanges(
        [
          { path: "model.provider", value: "openai" },
          { path: "model.id", value: "gpt-5-mini" },
          { path: "loop.enabled", value: false },
          { path: "agent.dataDir", value: "/tmp/new-agent-data" },
        ],
        "retune",
      );
      expect(mocks.getModel).toHaveBeenCalledWith("openai", "gpt-5-mini");
      expect(mocks.agent.setModel).toHaveBeenCalled();
      expect(mocks.ticker.stop).toHaveBeenCalled();
      const setDataDir = mocks.createGameAgent.mock.results[0]?.value?.setDataDir;
      expect(setDataDir).toHaveBeenCalledWith("/tmp/new-agent-data");

      await gameAgentCall.runtimeConfigManager.applyChanges([{ path: "world.rpcUrl", value: "http://rpc.next" }], "swap");
      expect(mocks.createClient).toHaveBeenCalledTimes(2);
      expect(mocks.createClient.mock.calls[1][0].rpcUrl).toBe("http://rpc.next");
      expect(mocks.sessionInstances).toHaveLength(2);

      await gameAgentCall.runtimeConfigManager.applyChanges([{ path: "game.name", value: "othergame" }], "game-swap");
      expect(mocks.createClient).toHaveBeenCalledTimes(3);
      expect(mocks.sessionInstances).toHaveLength(3);
      expect((mocks.sessionInstances[2]?.config as any)?.gameName).toBe("othergame");
      expect(exitSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
      exitSpy.mockRestore();
      onSpy.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects invalid or unknown config updates and can boot with loop disabled", async () => {
    const dir = mkdtempSync(join(tmpdir(), "onchain-invalid-config-"));
    const manifestPath = join(dir, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({ contracts: [] }));

    mocks.loadConfig.mockReturnValueOnce({
      rpcUrl: "http://rpc.local",
      toriiUrl: "http://torii.local",
      worldAddress: "0xworld",
      manifestPath,
      chainId: "SN_SEPOLIA",
      sessionBasePath: ".cartridge",
      tickIntervalMs: 1000,
      loopEnabled: false,
      modelProvider: "anthropic",
      modelId: "claude-test",
      gameName: "eternum",
      dataDir: "/tmp/agent-data",
    });
    mocks.createClient.mockResolvedValueOnce(mocks.client).mockRejectedValueOnce(new Error("first swap failed"));

    const onSpy = vi.spyOn(process, "on").mockImplementation(((event: string, cb: () => Promise<void>) => process) as any);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => undefined as never) as any);

    try {
      const mod = await import("../src/index");
      await (mod as any).main();

      expect(mocks.ticker.start).not.toHaveBeenCalled();
      const gameAgentCall = mocks.createGameAgent.mock.calls[0]?.[0];
      const first = await gameAgentCall.runtimeConfigManager.applyChanges([
        { path: "unknown.path", value: 1 },
        { path: "tickIntervalMs", value: 0 },
      ]);
      expect(first.ok).toBe(false);
      expect(first.results.some((r: any) => String(r.message).includes("Unknown config path"))).toBe(true);
      expect(first.results.some((r: any) => String(r.message).includes("Invalid positive number"))).toBe(true);

      const second = await gameAgentCall.runtimeConfigManager.applyChanges([{ path: "rpcUrl", value: "http://rpc.fail" }]);
      expect(second.ok).toBe(false);
      expect(second.results.some((r: any) => String(r.message).includes("Failed to apply"))).toBe(true);
    } finally {
      onSpy.mockRestore();
      logSpy.mockRestore();
      exitSpy.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
