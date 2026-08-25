// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("GameEntryModal play-route bootstrap ownership", () => {
  it("no longer owns play-route bootstrap or handoff state before navigating into /play", () => {
    const source = readSource("src/ui/features/landing/components/game-entry-modal.tsx");

    expect(source).not.toContain("useGameEntryBootstrapController");
    expect(source).not.toContain("recordPlayRouteHandoffFromHref");
  });
});
