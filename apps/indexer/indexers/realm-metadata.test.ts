import { describe, expect, it } from "vitest";

import { decodeRealmMetadata, readRealmMetadata } from "../../web/src/lib/realms/metadata";

describe("decodeRealmMetadata", () => {
  it("decodes an on-chain base64 JSON data URI", () => {
    const encoded = Buffer.from(JSON.stringify({ name: "Skassluk", attributes: [] })).toString("base64");

    expect(JSON.parse(decodeRealmMetadata(`data:application/json;base64,${encoded}`))).toEqual({
      name: "Skassluk",
      attributes: [],
    });
  });

  it("normalizes an already-decoded JSON value", () => {
    expect(decodeRealmMetadata('{ "name": "Realm #17" }')).toBe('{"name":"Realm #17"}');
  });

  it("rejects non-JSON metadata", () => {
    expect(() => decodeRealmMetadata("ipfs://not-json")).toThrow("Unsupported Realm metadata format");
  });
});

describe("readRealmMetadata", () => {
  it("calls the on-chain metadata entrypoint and decodes its result", async () => {
    const encoded = Buffer.from(JSON.stringify({ name: "Realm #17" })).toString("base64");
    const calls: { entrypoint: string; calldata: string[] }[] = [];

    const metadata = await readRealmMetadata((entrypoint, calldata) => {
      calls.push({ entrypoint, calldata });
      return Promise.resolve(`data:application/json;base64,${encoded}`);
    }, "17");

    expect(calls).toEqual([{ entrypoint: "get_decoded_metadata", calldata: ["17"] }]);
    expect(metadata).toBe('{"name":"Realm #17"}');
  });
});
