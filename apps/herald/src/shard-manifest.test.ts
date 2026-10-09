import { expect, it } from "vitest";

import { manifest } from "./native/fixtures";
import { assertShardChain, buildShardManifest, readShardDocument } from "./shard-manifest";

const document = {
  ...manifest,
  shard: {
    chainId: "0x4c4142",
    accountClassHash: "0x456",
    contracts: { bridge: "0x789" },
    guardianPublicKey: "0xabc",
    l2GasBound: "0x47868c00",
  },
};

it("serves the shard's chain, release, endpoint, play gas bound and every contract a client calls", () => {
  const served = buildShardManifest(document, { rpcUrl: "https://rpc.test" });
  expect(served).toMatchObject({
    chainId: "0x4c4142",
    releaseSchemas: { [manifest.native.releaseId]: manifest.native.activeSchema },
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

it("refuses a node whose chain differs from the shard it serves", () => {
  expect(() => assertShardChain(document, "0x4c4142")).not.toThrow();
  expect(() => assertShardChain(document, "0x999")).toThrow("declares 0x4c4142");
});

it("serves every published release schema, including games pinned behind the current release", () => {
  const releases = { "1": manifest.native.activeSchema, "2": "new-decoder" };
  const served = buildShardManifest(
    { ...document, native: { ...document.native, releaseId: 2, releaseSchemas: releases } },
    { rpcUrl: "https://rpc.test" },
  );
  expect(served.releaseSchemas).toEqual(releases);
  expect(served).not.toHaveProperty("schemaHash");
});
