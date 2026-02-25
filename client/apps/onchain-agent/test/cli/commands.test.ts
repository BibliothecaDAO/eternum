import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mainMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("../../src/index", () => ({
  main: mainMock,
}));

// Mock headless to avoid importing heavy dependencies
vi.mock("../../src/headless", () => ({
  mainHeadless: vi.fn().mockResolvedValue(undefined),
}));

// Mock commands to avoid importing heavy dependencies
const runWorldsMock = vi.hoisted(() => vi.fn().mockResolvedValue(0));
vi.mock("../../src/commands/worlds", () => ({
  runWorlds: runWorldsMock,
}));

const runAuthMock = vi.hoisted(() => vi.fn().mockResolvedValue(0));
vi.mock("../../src/commands/auth", () => ({
  runAuth: runAuthMock,
}));

const runAuthStatusMock = vi.hoisted(() => vi.fn().mockResolvedValue(0));
vi.mock("../../src/commands/auth-status", () => ({
  runAuthStatus: runAuthStatusMock,
}));

const runAuthUrlMock = vi.hoisted(() => vi.fn().mockResolvedValue(0));
vi.mock("../../src/commands/auth-url", () => ({
  runAuthUrl: runAuthUrlMock,
}));

describe("cli commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints version with --version", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { runCli } = await import("../../src/cli");

    const code = await runCli(["--version"]);

    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/^\d+\.\d+\.\d+/));
    expect(mainMock).not.toHaveBeenCalled();
  });

  it("invokes runtime on run command", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { runCli } = await import("../../src/cli");

    const code = await runCli(["run"]);

    expect(code).toBe(0);
    expect(mainMock).toHaveBeenCalledOnce();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("█"));
  });

  it("returns non-zero for unknown command", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { runCli } = await import("../../src/cli");

    const code = await runCli(["wat"]);

    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Unknown command"));
    expect(mainMock).not.toHaveBeenCalled();
  });

  it("prints help with expanded usage", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { runCli } = await import("../../src/cli");

    const code = await runCli(["--help"]);

    expect(code).toBe(0);
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("worlds");
    expect(output).toContain("auth");
    expect(output).toContain("--headless");
    expect(output).toContain("--api-port");
  });

  it("routes worlds command to runWorlds", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { runCli } = await import("../../src/cli");

    await runCli(["worlds", "--json"]);

    expect(runWorldsMock).toHaveBeenCalledOnce();
    expect(runWorldsMock).toHaveBeenCalledWith(expect.objectContaining({ json: true }));
  });

  it("rejects headless run without --world", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { runCli } = await import("../../src/cli");

    const code = await runCli(["run", "--headless"]);

    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("--world"));
  });
});
