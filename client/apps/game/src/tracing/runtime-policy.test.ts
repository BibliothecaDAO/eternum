import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { shouldEnableTracingRuntime } from "./runtime-policy";

const productionBuildEnvironments = [
  "../../.env.production",
  "../../.env.appchain.blitz",
  "../../.env.appchain.eternum",
  "../../.env.mainnet.blitz",
  "../../.env.mainnet.eternum",
  "../../.env.sepolia.blitz",
  "../../.env.sepolia.eternum",
  "../../../../../deploy/templates/preview.env.stub",
];

describe("tracing runtime policy", () => {
  it("never enables browser tracing in production", () => {
    expect(shouldEnableTracingRuntime({ configured: true, isProduction: true })).toBe(false);
  });

  it("requires an explicit opt-in outside production", () => {
    expect(shouldEnableTracingRuntime({ configured: false, isProduction: false })).toBe(false);
    expect(shouldEnableTracingRuntime({ configured: true, isProduction: false })).toBe(true);
  });

  it("keeps tracing disabled in every checked player build environment", () => {
    productionBuildEnvironments.forEach((relativePath) => {
      const contents = readFileSync(new URL(relativePath, import.meta.url), "utf8");
      expect(contents, relativePath).toMatch(/^VITE_TRACING_ENABLED=false$/m);
    });
  });

  it("keeps the side-effectful Zone context manager out of the eager telemetry chunk", () => {
    const viteConfig = readFileSync(resolve(process.cwd(), "vite.config.ts"), "utf8");

    expect(viteConfig).not.toContain('"@opentelemetry/context-zone"');
  });
});
