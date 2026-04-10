// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Game entry modal retry bootstrap", () => {
  it("tracks a bootstrap attempt token and retries by starting a fresh attempt", () => {
    const source = readSource("src/ui/features/landing/components/game-entry-modal.tsx");

    expect(source).toContain("const [bootstrapAttempt, setBootstrapAttempt] = useState(0);");
    expect(source).toContain("setBootstrapAttempt((attempt) => attempt + 1);");
    expect(source).toMatch(
      /},\s*\[isOpen,\s*isForgeMode,\s*isBlitzMode,\s*worldName,\s*chain,\s*updateTask,\s*bootstrapAttempt\]\);/s,
    );
  });
});
