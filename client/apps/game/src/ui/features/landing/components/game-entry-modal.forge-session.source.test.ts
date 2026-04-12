// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("game-entry-modal forge session source", () => {
  it("prepares the selected world's controller session before forging", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-entry-modal.tsx"),
      "utf8",
    );

    expect(source).toContain(
      'import { prepareControllerSessionForWorld } from "@/hooks/context/world-controller-session";',
    );
    expect(source).toContain("await prepareControllerSessionForWorld({");

    const prepareIndex = source.indexOf("await prepareControllerSessionForWorld({");
    const executeIndex = source.indexOf("await signer.execute(calls);");

    expect(prepareIndex).toBeGreaterThan(-1);
    expect(executeIndex).toBeGreaterThan(prepareIndex);
  });
});
