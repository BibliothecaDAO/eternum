// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("SignInPromptModal redirect state", () => {
  it("replays the original landing route state when sign-in finishes", () => {
    const source = readSource("src/ui/layouts/sign-in-prompt-modal.tsx");

    expect(source).toContain("redirectState?: SignInRedirectState;");
    expect(source).toContain("navigate(resolvedRedirectTo, { replace: true, state: redirectState });");
  });
});
