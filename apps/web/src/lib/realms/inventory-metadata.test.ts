import { describe, expect, it } from "vitest";

import { hydrateRealmMetadata } from "./inventory-metadata";

describe("Realm inventory metadata", () => {
  it("marks a failed on-chain metadata read as unavailable", async () => {
    const [realm] = await hydrateRealmMetadata([{ token_id: "3324", metadata: null }], {
      read: () => Promise.reject(new Error("RPC unavailable")),
      cache: () => Promise.resolve(),
    });

    expect(realm).toEqual({
      token_id: "3324",
      metadata: null,
      metadata_status: "unavailable",
    });
  });

  it("still returns loaded metadata when a cache write fails", async () => {
    const [realm] = await hydrateRealmMetadata([{ token_id: "1101", metadata: null }], {
      read: () => Promise.resolve('{"name":"Riilinrik"}'),
      cache: () => Promise.reject(new Error("database is read-only")),
    });

    expect(realm).toEqual({
      token_id: "1101",
      metadata: '{"name":"Riilinrik"}',
      metadata_status: "ready",
    });
  });
});
