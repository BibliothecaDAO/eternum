// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";
import type { RealmAutomationConfig } from "@/hooks/store/use-automation-store";
import { computeAutomationConfigSignature } from "./automation-signature";

const baseRealm = (overrides: Partial<RealmAutomationConfig>): RealmAutomationConfig => ({
  realmId: "1",
  realmName: "Realm 1",
  entityType: "realm",
  presetId: "smart",
  autoBalance: false,
  customPercentages: {},
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

describe("computeAutomationConfigSignature", () => {
  it("changes when autoBalance toggles", () => {
    const off = computeAutomationConfigSignature({ "1": baseRealm({ autoBalance: false }) });
    const on = computeAutomationConfigSignature({ "1": baseRealm({ autoBalance: true }) });
    expect(off).not.toEqual(on);
  });

  it("changes when a percentage value changes", () => {
    const a = computeAutomationConfigSignature({
      "1": baseRealm({
        presetId: "custom",
        customPercentages: {
          [ResourcesIds.Knight]: { resourceToResource: 10, laborToResource: 0 },
        },
      }),
    });
    const b = computeAutomationConfigSignature({
      "1": baseRealm({
        presetId: "custom",
        customPercentages: {
          [ResourcesIds.Knight]: { resourceToResource: 15, laborToResource: 0 },
        },
      }),
    });
    expect(a).not.toEqual(b);
  });

  it("is stable across insertion order of percentages", () => {
    const a = computeAutomationConfigSignature({
      "1": baseRealm({
        presetId: "custom",
        customPercentages: {
          [ResourcesIds.Knight]: { resourceToResource: 10, laborToResource: 5 },
          [ResourcesIds.Crossbowman]: { resourceToResource: 20, laborToResource: 0 },
        },
      }),
    });
    const b = computeAutomationConfigSignature({
      "1": baseRealm({
        presetId: "custom",
        customPercentages: {
          [ResourcesIds.Crossbowman]: { resourceToResource: 20, laborToResource: 0 },
          [ResourcesIds.Knight]: { resourceToResource: 10, laborToResource: 5 },
        },
      }),
    });
    expect(a).toEqual(b);
  });

  it("changes when preset changes", () => {
    const smart = computeAutomationConfigSignature({ "1": baseRealm({ presetId: "smart" }) });
    const idle = computeAutomationConfigSignature({ "1": baseRealm({ presetId: "idle" }) });
    expect(smart).not.toEqual(idle);
  });

  it("does not include non-managed entities", () => {
    const managedOnly = computeAutomationConfigSignature({ "1": baseRealm({}) });
    const withExtra = computeAutomationConfigSignature({
      "1": baseRealm({}),
      // @ts-expect-error simulate a non-managed entityType slipping in
      "2": baseRealm({ realmId: "2", entityType: "bank" }),
    });
    expect(managedOnly).toEqual(withExtra);
  });
});
