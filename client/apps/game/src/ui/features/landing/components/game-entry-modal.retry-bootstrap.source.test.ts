// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Game entry modal retry bootstrap", () => {
  it("retries through the shared bootstrap controller instead of managing a local attempt token", () => {
    const source = readSource("src/ui/features/landing/components/game-entry-modal.tsx");

    expect(source).toContain("useGameEntryBootstrapController");
    expect(source).toContain("bootstrapController.retry()");
    expect(source).not.toContain("bootstrapAttempt");
  });
});
