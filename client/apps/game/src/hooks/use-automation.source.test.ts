// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("useAutomation source", () => {
  it("uses readable automation failure messages instead of stringifying structured errors", () => {
    const source = readSource("src/hooks/use-automation.tsx");

    expect(source).toContain("extractReadableErrorMessage");
    expect(source).not.toContain("String(rawError)");
  });
});
