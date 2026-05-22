// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("world connection monitor wiring", () => {
  it("checks the active world's Torii health endpoint instead of the build-time default", () => {
    const source = readSource("src/ui/layouts/world.tsx");

    expect(source).toContain("useActiveWorldProfile");
    expect(source).toContain("activeWorld?.toriiBaseUrl ?? env.VITE_PUBLIC_TORII");
    expect(source).not.toContain("const toriiBaseUrl = env.VITE_PUBLIC_TORII;");
  });

  it("requests a guarded route-level rebootstrap from onDeadEnd so wedged consumers recover", () => {
    const source = readSource("src/ui/layouts/world.tsx");
    const bootstrapControllerSource = readSource("src/game-entry/bootstrap-controller.ts");

    expect(source).toContain("requestGameRebootstrap");
    expect(source).not.toContain("bootstrapGameForEntryContext");
    expect(source).not.toContain("resetBootstrap");
    expect(source).toContain("shouldRunDeadEndRecovery");
    expect(source).toContain("toriiBaseUrl, reason");
    expect(bootstrapControllerSource).toContain("export const requestGameRebootstrap");
    expect(bootstrapControllerSource).toContain("resetBootstrap()");
  });
});
