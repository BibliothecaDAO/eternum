// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("PlayView sign-in entry redirects", () => {
  it("preserves the originating landing tab when sign-in gates the entry route", () => {
    const source = readSource("src/ui/features/landing/views/play-view.tsx");

    expect(source).toContain("const entryRedirectState = { returnTo: currentLandingHref };");
    expect(source).toContain("redirectState={entryRedirectState}");
  });
});
