import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../../src/cli-args";

describe("parseCliArgs", () => {
  it("defaults to run command with TUI", () => {
    const opts = parseCliArgs([]);
    expect(opts.command).toBe("run");
    expect(opts.headless).toBe(false);
    expect(opts.json).toBe(false);
  });

  it("parses run --headless --world=my-world", () => {
    const opts = parseCliArgs(["run", "--headless", "--world=my-world"]);
    expect(opts.command).toBe("run");
    expect(opts.headless).toBe(true);
    expect(opts.world).toBe("my-world");
  });

  it("parses run with --api-port and --stdin", () => {
    const opts = parseCliArgs(["run", "--headless", "--world=x", "--api-port=3000", "--stdin"]);
    expect(opts.apiPort).toBe(3000);
    expect(opts.stdin).toBe(true);
  });

  it("parses run with --auth=privatekey", () => {
    const opts = parseCliArgs(["run", "--headless", "--world=x", "--auth=privatekey"]);
    expect(opts.auth).toBe("privatekey");
  });

  it("parses run with --verbosity", () => {
    const opts = parseCliArgs(["run", "--headless", "--world=x", "--verbosity=actions"]);
    expect(opts.verbosity).toBe("actions");
  });

  it("parses worlds --json", () => {
    const opts = parseCliArgs(["worlds", "--json"]);
    expect(opts.command).toBe("worlds");
    expect(opts.json).toBe(true);
  });

  it("parses auth <world> --approve --method=password", () => {
    const opts = parseCliArgs([
      "auth",
      "my-world",
      "--approve",
      "--method=password",
      "--username=bot",
      "--password=pass123",
    ]);
    expect(opts.command).toBe("auth");
    expect(opts.world).toBe("my-world");
    expect(opts.approve).toBe(true);
    expect(opts.method).toBe("password");
    expect(opts.username).toBe("bot");
    expect(opts.password).toBe("pass123");
  });

  it("parses auth --all --json", () => {
    const opts = parseCliArgs(["auth", "--all", "--json"]);
    expect(opts.command).toBe("auth");
    expect(opts.all).toBe(true);
    expect(opts.json).toBe(true);
  });

  it("parses auth-status <world> --json", () => {
    const opts = parseCliArgs(["auth-status", "my-world", "--json"]);
    expect(opts.command).toBe("auth-status");
    expect(opts.world).toBe("my-world");
    expect(opts.json).toBe(true);
  });

  it("parses auth-url <world>", () => {
    const opts = parseCliArgs(["auth-url", "my-world"]);
    expect(opts.command).toBe("auth-url");
    expect(opts.world).toBe("my-world");
  });

  it("parses --api-host", () => {
    const opts = parseCliArgs(["run", "--headless", "--world=x", "--api-port=3000", "--api-host=0.0.0.0"]);
    expect(opts.apiHost).toBe("0.0.0.0");
  });

  it("defaults auth to session", () => {
    const opts = parseCliArgs(["run", "--headless", "--world=x"]);
    expect(opts.auth).toBe("session");
  });

  it("defaults verbosity to decisions", () => {
    const opts = parseCliArgs(["run", "--headless", "--world=x"]);
    expect(opts.verbosity).toBe("decisions");
  });
});
