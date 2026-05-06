import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("latest feature shared presentation usage", () => {
  it("keeps the landing news view on the shared presentation helper", () => {
    const source = readSource("src/ui/features/landing/views/play-view.tsx");

    expect(source).toContain("getLatestFeaturePresentation");
  });

  it("keeps the latest features popup on the shared presentation helper", () => {
    const source = readSource("src/ui/modules/latest-features/latest-features.tsx");

    expect(source).toContain("getLatestFeaturePresentation");
  });
});
