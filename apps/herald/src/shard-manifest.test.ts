import { expect, it } from "vitest";

import { manifest } from "./native/fixtures";
import { assertShardChain, buildShardManifest, readShardDocument } from "./shard-manifest";
import { releaseLine } from "../../../packages/core/src/test-support/releases";

const document = {
  ...manifest,
  shard: {
    chainId: "0x4c4142",
    accountClassHash: "0x456",
    contracts: { bridge: "0x789" },
    guardianPublicKey: "0xabc",
    l2GasBound: "0x47868c00",
    vrfPublicKey: { x: "0x1", y: "0x2" },
  },
};

it("serves the shard's chain, release, endpoint, play gas bound and every contract a client calls", () => {
  const served = buildShardManifest(document, { rpcUrl: "https://rpc.test" });
  expect(served).toMatchObject({
    chainId: "0x4c4142",
    releases: releaseLine(manifest.native.activeSchema, [manifest.native.releaseId]),
    rpcUrl: "https://rpc.test",
    accountClassHash: "0x456",
    guardianPublicKey: "0xabc",
    l2GasBound: "0x47868c00",
  });
  expect(served).not.toHaveProperty("admissionUrl");
  expect(served.contracts).toMatchObject({ games: manifest.world.address, bridge: "0x789" });
});

it("reads a deployment document only with a shard record that has a guardian public key and a play gas bound", () => {
  expect(readShardDocument(JSON.stringify(document))).toEqual(document);
  const { guardianPublicKey: _, ...unguarded } = document.shard;
  expect(() => readShardDocument(JSON.stringify({ ...document, shard: unguarded }))).toThrow("no guardian public key");
  const { l2GasBound: _bound, ...unbounded } = document.shard;
  expect(() => readShardDocument(JSON.stringify({ ...document, shard: unbounded }))).toThrow("no l2GasBound");
  const { shard: __, ...unsharded } = document;
  expect(() => readShardDocument(JSON.stringify(unsharded))).toThrow("no shard record");
});

it("refuses a deployment document that lists release schemas without their families", () => {
  const { releases, ...native } = document.native;
  const old = { ...document, native: { ...native, releaseSchemas: { "1": releases["1"]!.schema } } };
  expect(() => readShardDocument(JSON.stringify(old))).toThrow("lists no releases with their families");
});

it("refuses a node whose chain differs from the shard it serves", () => {
  expect(() => assertShardChain(document, "0x4c4142")).not.toThrow();
  expect(() => assertShardChain(document, "0x999")).toThrow("declares 0x4c4142");
});

it("serves every published release with its family and previous, including games pinned behind the current release", () => {
  const releases = {
    "1": { schema: manifest.native.activeSchema, family: 1, previous: 0 },
    "2": { schema: "new-decoder", family: 1, previous: 1 },
  };
  const served = buildShardManifest(
    { ...document, native: { ...document.native, releaseId: 2, releases } },
    { rpcUrl: "https://rpc.test" },
  );
  expect(served.releases).toEqual(releases);
  expect(served).not.toHaveProperty("schemaHash");
});
