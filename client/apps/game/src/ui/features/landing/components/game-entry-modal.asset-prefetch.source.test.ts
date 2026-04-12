// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("GameEntryModal bootstrap controller adoption", () => {
  it("routes entry bootstrap through the shared controller instead of priming assets inline", () => {
    const source = readSource("src/ui/features/landing/components/game-entry-modal.tsx");

    expect(source).toContain("useGameEntryBootstrapController");
    expect(source).toContain("bootstrapController.retry()");
    expect(source).not.toContain("primePlayEntryAssets()");
  });
});
