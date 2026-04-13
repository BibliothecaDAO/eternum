// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("GameEntryModal world-scoped SQL reads", () => {
  it("uses a selected-world SQL client instead of the process-global gameplay SQL singleton", () => {
    const source = readSource("src/ui/features/landing/components/game-entry-modal.tsx");

    expect(source).toContain("createSqlApi");
    expect(source).toContain("resolveWorldSqlBaseUrl");
    expect(source).toContain("selectedWorldSqlApi");
    expect(source).not.toContain("const sqlBaseUrl = getSqlApiBaseUrl();");
  });
});
