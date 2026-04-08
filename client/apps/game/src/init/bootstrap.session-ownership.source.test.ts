// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("bootstrap session ownership", () => {
  it("keeps mutable bootstrap session state out of the orchestration module", () => {
    const source = readSource("src/init/bootstrap.tsx");

    expect(source).not.toContain("let bootstrapPromise");
    expect(source).not.toContain("let bootstrappedWorldName");
    expect(source).not.toContain("let bootstrappedChain");
    expect(source).not.toContain("let cachedSetupResult");
    expect(source).not.toContain("let gameRendererCleanup");
  });
});
