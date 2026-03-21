import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Game entry modal dev preview reset", () => {
  it("offers a clear-preview action without implying remote registration changed", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-entry-modal.tsx"),
      "utf8",
    );

    expect(source).toContain("clearPreview");
    expect(source).toContain("Clear Preview");
    expect(source).toContain("This only affects your current browser session.");
  });
});
