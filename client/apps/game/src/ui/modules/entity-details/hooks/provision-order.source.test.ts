// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

/**
 * Locks the blitz "bootstrap" invariant: provision_realm must run BEFORE
 * level_up, and clicking the pickaxe must only require provisioning (not an
 * affordable upgrade). provision_realm grants the realm's starting resources;
 * level_up spends them. A freshly settled realm has no economy until provisioned,
 * so the reverse order reverts and gating on canUpgrade blocks players entirely.
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
    expect(src).toContain("if (!structureEntityId || !canProvision) return;");
    // The level-up is opt-in inside the handler.
    expect(src).toContain("if (canUpgrade) {");
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
