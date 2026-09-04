// @vitest-environment node

import { describe, expect, it } from "vitest";
import type { RealmInfo } from "@bibliothecadao/types";
import { resolveInitialSelectedRealm } from "./production-selection";

const buildRealm = (entityId: number, name: string): RealmInfo =>
  ({
    // The selection helpers only read entityId, so the test fixture can stay partial.
    entityId,
    position: { x: entityId, y: entityId + 1 },
    structure: {
      entity_id: entityId,
      category: 0,
      base: {
        coord_x: entityId,
        coord_y: entityId + 1,
      },
      metadata: {
        name,
      },
    },
  }) as unknown as RealmInfo;

describe("resolveInitialSelectedRealm", () => {
  const realms = [buildRealm(101, "Alpha"), buildRealm(202, "Beta"), buildRealm(303, "Gamma")];

  it("uses the preselected realm when provided", () => {
    expect(
      resolveInitialSelectedRealm({
        realms,
        preSelectedRealmId: 202,
        currentStructureEntityId: 101,
      }),
    ).toBe(realms[1]);
  });

  it("falls back to the current global structure when no explicit preselected realm is provided", () => {
    expect(
      resolveInitialSelectedRealm({
        realms,
        currentStructureEntityId: 303,
      }),
    ).toBe(realms[2]);
  });

  it("falls back to the first managed realm when neither preferred id is usable", () => {
    expect(
      resolveInitialSelectedRealm({
        realms,
        preSelectedRealmId: 404,
        currentStructureEntityId: 505,
      }),
    ).toBe(realms[0]);
  });
});
