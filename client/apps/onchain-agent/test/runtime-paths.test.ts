import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { homedir } from "node:os";
import { resolveDefaultDataDir, resolveDefaultSessionBasePath } from "../src/runtime-paths";

describe("resolveDefaultDataDir", () => {
  it("returns ETERNUM_AGENT_HOME/data when set", () => {
    const env = { ETERNUM_AGENT_HOME: "/opt/agent" } as NodeJS.ProcessEnv;
    expect(resolveDefaultDataDir(env)).toBe("/opt/agent/data");
  });

  it("returns ~/.eternum-agent/data when ETERNUM_AGENT_HOME unset", () => {
    const env = {} as NodeJS.ProcessEnv;
    expect(resolveDefaultDataDir(env)).toBe(path.join(homedir(), ".eternum-agent", "data"));
  });

  it("expands tilde in ETERNUM_AGENT_HOME", () => {
    const env = { ETERNUM_AGENT_HOME: "~/my-agent" } as NodeJS.ProcessEnv;
    expect(resolveDefaultDataDir(env)).toBe(path.join(homedir(), "my-agent", "data"));
  });

  it("trims whitespace from ETERNUM_AGENT_HOME", () => {
    const env = { ETERNUM_AGENT_HOME: "  /opt/agent  " } as NodeJS.ProcessEnv;
    expect(resolveDefaultDataDir(env)).toBe("/opt/agent/data");
  });

  it("treats empty string as unset (falls back to default)", () => {
    const env = { ETERNUM_AGENT_HOME: "" } as NodeJS.ProcessEnv;
    expect(resolveDefaultDataDir(env)).toBe(path.join(homedir(), ".eternum-agent", "data"));
  });

  it("treats whitespace-only as unset", () => {
    const env = { ETERNUM_AGENT_HOME: "   " } as NodeJS.ProcessEnv;
    expect(resolveDefaultDataDir(env)).toBe(path.join(homedir(), ".eternum-agent", "data"));
  });

  it("resolves relative ETERNUM_AGENT_HOME to absolute", () => {
    const env = { ETERNUM_AGENT_HOME: "relative/path" } as NodeJS.ProcessEnv;
    const result = resolveDefaultDataDir(env);
    expect(path.isAbsolute(result)).toBe(true);
    expect(result).toBe(path.resolve("relative/path", "data"));
  });
});

describe("resolveDefaultSessionBasePath", () => {
  it("returns ETERNUM_AGENT_HOME/.cartridge when set", () => {
    const env = { ETERNUM_AGENT_HOME: "/opt/agent" } as NodeJS.ProcessEnv;
    expect(resolveDefaultSessionBasePath(env)).toBe("/opt/agent/.cartridge");
  });

  it("returns ~/.eternum-agent/.cartridge when ETERNUM_AGENT_HOME unset", () => {
    const env = {} as NodeJS.ProcessEnv;
    expect(resolveDefaultSessionBasePath(env)).toBe(path.join(homedir(), ".eternum-agent", ".cartridge"));
  });

  it("expands tilde in ETERNUM_AGENT_HOME", () => {
    const env = { ETERNUM_AGENT_HOME: "~/my-agent" } as NodeJS.ProcessEnv;
    expect(resolveDefaultSessionBasePath(env)).toBe(path.join(homedir(), "my-agent", ".cartridge"));
  });
});
