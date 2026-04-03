import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("SignInPromptModal source", () => {
  it("closes after connect without redirecting to the generic play route", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/layouts/sign-in-prompt-modal.tsx"), "utf8");

    expect(source).not.toContain('navigate("/play")');
    expect(source).toContain("setModal(null, false)");
  });
});
