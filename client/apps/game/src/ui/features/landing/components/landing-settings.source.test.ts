// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Landing settings isolation", () => {
  it("keeps the dashboard settings panel free of Dojo-bound react package hooks", () => {
    const source = readSource("src/ui/features/landing/components/landing-settings.tsx");

    expect(source).not.toContain("@bibliothecadao/react");
    expect(source).toContain("isDocumentFullScreen");
    expect(source).toContain("fullscreenchange");
  });
});
