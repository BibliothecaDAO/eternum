import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("StarknetProvider factory bootstrap guard", () => {
  it("skips bootstrap on the home factory tab as well as standalone factory routes", () => {
    const source = readFileSync(resolve(process.cwd(), "src/hooks/context/starknet-provider.tsx"), "utf8");

    expect(source).toContain('window.location.pathname.startsWith("/factory")');
    expect(source).toContain('new URLSearchParams(window.location.search).get("tab") === "factory"');
  });
});
