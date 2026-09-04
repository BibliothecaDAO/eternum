// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

/**
 * Locks the blitz "bootstrap" invariants: provision_realm must run BEFORE
 * level_up whenever the two calls are bundled, and clicking the pickaxe must
 * still provision when an immediate upgrade is unaffordable. A freshly settled
 * realm has no economy until provisioned, so forcing the bundle before the
 * level-up is affordable reverts the whole transaction.
 */
describe("blitz bootstrap fires provision before level_up", () => {
  it("useRealmActions multicall lists the provision call first", () => {
    const src = readSource("src/ui/modules/entity-details/hooks/use-realm-actions.ts");
    expect(src).toContain("[provisionCall, upgradeCall]");
    expect(src).not.toContain("[upgradeCall, provisionCall]");
  });

  it("useRealmUpgradeAndProvision builds provision_realm before level_up", () => {
    const src = readSource("src/ui/modules/entity-details/hooks/use-realm-upgrade-and-provision.ts");
    const provisionIdx = src.indexOf('entrypoint: "provision_realm"');
    const levelUpIdx = src.indexOf('entrypoint: "level_up"');
    expect(provisionIdx).toBeGreaterThanOrEqual(0);
    expect(levelUpIdx).toBeGreaterThanOrEqual(0);
    expect(provisionIdx).toBeLessThan(levelUpIdx);
  });

  it("useRealmUpgradeAndProvision gates the action on provisioning, not on the upgrade", () => {
    const src = readSource("src/ui/modules/entity-details/hooks/use-realm-upgrade-and-provision.ts");
    // Provision is the floor — clicking must not require canUpgrade.
    expect(src).toContain("!canProvision");
    // Provision-only delegates to the standalone provision flow (which locks
    // through torii sync); the bundled upgrade is the affordable-only branch.
    expect(src).toContain("if (!canUpgrade)");
    expect(src).toContain("provision.handleProvision()");
  });

  it("suggestions bundle level_up only when the upgrade is affordable", () => {
    const src = readSource("src/ui/features/world/containers/left-facets/blitz-suggestions.ts");
    expect(src).toContain("if (input.canProvision)");
    expect(src).toContain("input.canAffordUpgrade");
    expect(src).toContain('"provision"');
    expect(src).toContain('"upgrade-and-provision"');
  });

  it("chip + castle enable the bootstrap pickaxe on canProvision, not canUpgradeAndProvision", () => {
    const chip = readSource("src/ui/features/world/containers/top-header/structure-picker/chip.tsx");
    expect(chip).toContain("!bootstrapInfo.canProvision");
    expect(chip).not.toContain("!bootstrapInfo.canUpgradeAndProvision");

    const castle = readSource("src/ui/modules/entity-details/realm/castle.tsx");
    expect(castle).toContain("bootstrapInfo.canProvision");
    expect(castle).not.toContain("bootstrapInfo.canUpgradeAndProvision");
  });
});
