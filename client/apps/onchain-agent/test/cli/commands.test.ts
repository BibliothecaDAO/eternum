import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mainMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("../../src/index", () => ({
  main: mainMock,
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
    const { runCli } = await import("../../src/cli");

    const code = await runCli(["run"]);

    expect(code).toBe(0);
    expect(mainMock).toHaveBeenCalledOnce();
  });

  it("returns non-zero for unknown command", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { runCli } = await import("../../src/cli");

    const code = await runCli(["wat"]);

    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Unknown command"));
    expect(mainMock).not.toHaveBeenCalled();
  });
});
