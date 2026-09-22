import { expect, it } from "vitest";

import { manifest } from "./native/fixtures";
import { assertShardChain, buildShardManifest } from "./shard-manifest";

const document = {
  ...manifest,
  shard: { chainId: "0x4c4142", accountClassHash: "0x456", contracts: { playerRegistry: "0x789" } },
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
  });
  expect(served.contracts).toMatchObject({ season: manifest.native.domains.season.address, playerRegistry: "0x789" });
});

it("refuses a node whose chain differs from the shard it serves", () => {
  expect(() => assertShardChain(document, "0x4c4142")).not.toThrow();
  expect(() => assertShardChain(document, "0x999")).toThrow("declares 0x4c4142");
});
