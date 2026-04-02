// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readHookSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "use-army-entity-detail.ts"), "utf8");
}

describe("useArmyEntityDetail stamina source wiring", () => {
  it("reads live explorer troops from the ECS component and routes stamina through the source resolver", () => {
    const source = readHookSource();

    expect(source).toContain("const liveExplorerTroops = useComponentValue");
    expect(source).toContain("resolveArmyDetailTroopsSource({");
    expect(source).toContain("liveExplorerTroops,");
    expect(source).toContain("queryExplorerTroops: explorer?.troops,");
    expect(source).toContain("StaminaManager.getStamina(staminaTroops, currentArmiesTick)");
  });
});
