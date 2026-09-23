import { expect, it } from "vitest";

import { manifest } from "./native/fixtures";
import { assertShardChain, buildShardManifest } from "./shard-manifest";

const document = {
  ...manifest,
  shard: {
    chainId: "0x4c4142",
    accountClassHash: "0x456",
    contracts: { bridge: "0x789" },
    guardianPublicKey: "0xabc",
  },
};

it("serves the shard's chain, release, endpoints and every contract a client calls", () => {
  const served = buildShardManifest(document, { rpcUrl: "https://rpc.test", admissionUrl: "https://admission.test" });
  expect(served).toMatchObject({
    chainId: "0x4c4142",
    releaseId: manifest.native.activeSchema,
    schemaHash: manifest.native.activeSchema,
    rpcUrl: "https://rpc.test",
    admissionUrl: "https://admission.test",
    accountClassHash: "0x456",
    guardianPublicKey: "0xabc",
  });
  expect(served.contracts).toMatchObject({ season: manifest.native.domains.season.address, bridge: "0x789" });
});

it("refuses a shard record without a guardian public key", () => {
  const endpoints = { rpcUrl: "https://rpc.test", admissionUrl: "https://admission.test" };
  const { guardianPublicKey: _, ...unguarded } = document.shard;
  expect(() => buildShardManifest({ ...document, shard: unguarded as typeof document.shard }, endpoints)).toThrow(
    "no guardian public key",
  );
});

it("refuses a node whose chain differs from the shard it serves", () => {
  expect(() => assertShardChain(document, "0x4c4142")).not.toThrow();
  expect(() => assertShardChain(document, "0x999")).toThrow("declares 0x4c4142");
});
