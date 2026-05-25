// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("GameEntryModal entry ownership", () => {
  it("does not reintroduce inline bootstrap or asset priming into the landing modal", () => {
    const source = readSource("src/ui/features/landing/components/game-entry-modal.tsx");

    expect(source).not.toContain("useGameEntryBootstrapController");
    expect(source).not.toContain("bootstrapController.retry()");
    expect(source).not.toContain("primePlayEntryAssets()");
  });
});
