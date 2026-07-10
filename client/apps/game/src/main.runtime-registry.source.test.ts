// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("runtime registry startup", () => {
  it("loads the public registry before importing modules that resolve endpoints", () => {
    const source = readFileSync(resolve(process.cwd(), "src/main.tsx"), "utf8");

    expect(source).not.toContain('import App from "./app"');
    expect(source.indexOf("await loadConfiguredRuntimeRegistry()")).toBeLessThan(
      source.indexOf('await import("./app")'),
    );
  });
});
