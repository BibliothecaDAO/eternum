import { afterEach, describe, expect, it, vi } from "vitest";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalDatabaseSsl = process.env.DATABASE_SSL;

afterEach(() => {
  restoreEnvironmentValue("DATABASE_URL", originalDatabaseUrl);
  restoreEnvironmentValue("DATABASE_SSL", originalDatabaseSsl);
  vi.resetModules();
});

describe("drizzle config", () => {
  it("keeps TLS enabled by default", async () => {
    process.env.DATABASE_URL = "postgres://example.invalid/realms";
    delete process.env.DATABASE_SSL;

    const config = (await import("./drizzle.config")).default;

    expect(config.dbCredentials.ssl).toBe(true);
    expect(config.tablesFilter).toEqual(["!herald_*"]);
  });

  it("allows plain local Postgres only when explicitly requested", async () => {
    process.env.DATABASE_URL = "postgres://127.0.0.1/realms";
    process.env.DATABASE_SSL = "false";

    const config = (await import("./drizzle.config")).default;

    expect(config.dbCredentials.ssl).toBe(false);
  });
});

function restoreEnvironmentValue(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
