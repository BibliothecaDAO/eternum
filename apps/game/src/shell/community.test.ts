import { REALMS_X_TAG, REALMS_X_URL } from "@realms-world/chain";
import { describe, expect, it } from "vitest";

import { communityPlace, X_HANDLE } from "./community";
import { twitterTemplates } from "@/ui/shared/lib/x-share-messages";

// That no surface writes the account by hand is checked repository-wide: scripts/check-realms-x-account.mjs.
describe("the realm's X account", () => {
  it("is the canonical one, on the footer and in every share message", () => {
    expect(communityPlace("X").href).toBe(REALMS_X_URL);
    expect(X_HANDLE).toBe(REALMS_X_TAG);
    for (const template of Object.values(twitterTemplates)) expect(template).toContain(REALMS_X_TAG);
  });
});
