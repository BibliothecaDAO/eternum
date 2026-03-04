import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadEnvFile } from "../../src/env-loader";

describe("loadEnvFile", () => {
  let dir: string;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "env-loader-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    // Restore any env vars we touched
    for (const [key, val] of Object.entries(saved)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  function setEnv(key: string, value: string | undefined) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  it("loads KEY=VALUE pairs into process.env", () => {
    const envFile = join(dir, ".env");
    writeFileSync(envFile, "TEST_ENV_LOADER_A=hello\nTEST_ENV_LOADER_B=world\n");
    setEnv("TEST_ENV_LOADER_A", undefined);
    setEnv("TEST_ENV_LOADER_B", undefined);

    loadEnvFile(envFile);

    expect(process.env.TEST_ENV_LOADER_A).toBe("hello");
    expect(process.env.TEST_ENV_LOADER_B).toBe("world");
  });

  it("does not override existing shell env vars", () => {
    const envFile = join(dir, ".env");
    writeFileSync(envFile, "TEST_ENV_LOADER_C=from-file\n");
    setEnv("TEST_ENV_LOADER_C", "from-shell");

    loadEnvFile(envFile);

    expect(process.env.TEST_ENV_LOADER_C).toBe("from-shell");
  });

  it("overrides when override=true", () => {
    const envFile = join(dir, ".env");
    writeFileSync(envFile, "TEST_ENV_LOADER_D=from-file\n");
    setEnv("TEST_ENV_LOADER_D", "from-global");

    loadEnvFile(envFile, true);

    expect(process.env.TEST_ENV_LOADER_D).toBe("from-file");
  });

  it("skips comments and blank lines", () => {
    const envFile = join(dir, ".env");
    writeFileSync(envFile, "# comment\n\nTEST_ENV_LOADER_E=yes\n  # indented comment\n");
    setEnv("TEST_ENV_LOADER_E", undefined);

    loadEnvFile(envFile);

    expect(process.env.TEST_ENV_LOADER_E).toBe("yes");
  });

  it("strips surrounding quotes", () => {
    const envFile = join(dir, ".env");
    writeFileSync(envFile, "TEST_ENV_LOADER_F=\"quoted\"\nTEST_ENV_LOADER_G='single'\n");
    setEnv("TEST_ENV_LOADER_F", undefined);
    setEnv("TEST_ENV_LOADER_G", undefined);

    loadEnvFile(envFile);

    expect(process.env.TEST_ENV_LOADER_F).toBe("quoted");
    expect(process.env.TEST_ENV_LOADER_G).toBe("single");
  });

  it("handles export prefix", () => {
    const envFile = join(dir, ".env");
    writeFileSync(envFile, "export TEST_ENV_LOADER_H=exported\n");
    setEnv("TEST_ENV_LOADER_H", undefined);

    loadEnvFile(envFile);

    expect(process.env.TEST_ENV_LOADER_H).toBe("exported");
  });

  it("handles values with = signs", () => {
    const envFile = join(dir, ".env");
    writeFileSync(envFile, "TEST_ENV_LOADER_I=abc=def=ghi\n");
    setEnv("TEST_ENV_LOADER_I", undefined);

    loadEnvFile(envFile);

    expect(process.env.TEST_ENV_LOADER_I).toBe("abc=def=ghi");
  });

  it("is a no-op for missing files", () => {
    loadEnvFile(join(dir, "nonexistent"));
    // No throw
  });
});
