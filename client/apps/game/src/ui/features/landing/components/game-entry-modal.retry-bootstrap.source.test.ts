// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Game entry modal retry bootstrap", () => {
  it("bumps an explicit preflight retry token so blitz settlement checks rerun after retry", () => {
    const source = readSource("src/ui/features/landing/components/game-entry-modal.tsx");

    expect(source).toContain("const [preflightRetryNonce, setPreflightRetryNonce] = useState(0);");
    expect(source).toContain("setPreflightRetryNonce((current) => current + 1);");
    expect(source).toContain("preflightRetryNonce,");
  });
});
