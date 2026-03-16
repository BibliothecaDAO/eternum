import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Game card dev preview entry visibility", () => {
  it("renders a separate dev-only local preview action for unregistered live games", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-selector/game-card-grid.tsx"),
      "utf8",
    );

    expect(source).toContain(
      "const showPreviewButton = import.meta.env.DEV && isOngoing && !showRegistered && Boolean(playerAddress) && canPreviewEnter;",
    );
    expect(source).toContain("Local Preview");
    expect(source).toContain("onPreviewEnter");
  });
});
