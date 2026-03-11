import { describe, expect, it } from "vitest";
import fullRealms from "../../../../client/public/jsons/realms.json";
import { getRealmNameById } from "./realm-names";

describe("realm-names parity", () => {
  it("matches canonical realm names for representative ids", () => {
    const full = fullRealms as Record<string, { name: string }>;
    const sampleIds = [1, 42, 777, 2048, 4096, 8000];

    for (const realmId of sampleIds) {
      expect(getRealmNameById(realmId)).toBe(full[String(realmId)]?.name ?? "");
    }
  });
});
