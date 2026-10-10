import { expect, test } from "bun:test";
import { inspectGameRoles } from "./inspect-shard-roles";
import type { RpcProvider } from "starknet";
import type { NativeWorldManifest } from "../../../config/deployer/clean/world/native/types";

function fixture(initialized: boolean, views: Record<string, string[]> = {}, device = "0x1") {
  const calls: string[] = [];
  const values = {
    authentication: ["0x9", "0x7"],
    owner: ["0x22"],
    launcher: ["0x22"],
    ledger_operator: ["0x22"],
    vrf_public_key: ["0xb", "0xc"],
    l2_gas_bound: ["0x47868c00"],
    ...views,
  };
  return {
    calls,
    input: {
      initialized,
      bootstrap: "0x22",
      host: { deployer: { address: "0x11", publicKey: "0x1", classHash: "0x8" } },
      manifest: {
        world: { address: "0x33" },
        shard: {
          accountClassHash: "0x9",
          guardianPublicKey: "0x7",
          vrfPublicKey: { x: "0xb", y: "0xc" },
          l2GasBound: "0x47868c00",
        },
      } as NativeWorldManifest,
      provider: {
        getClassHashAt: async (address: string) => (address === "0x11" ? "0x8" : "0x9"),
        getStorageAt: async (address: string) => (address === "0x11" ? "0x1" : "0x7"),
        callContract: async ({ entrypoint }: { entrypoint: string }) => {
          calls.push(entrypoint);
          return entrypoint === "is_device" ? [device] : values[entrypoint as keyof typeof values];
        },
      } as unknown as RpcProvider,
    },
  };
}

test("fresh initialization requires the bootstrap's roles and active device", async () => {
  await expect(inspectGameRoles(fixture(false).input)).resolves.toHaveLength(4);
  await expect(inspectGameRoles(fixture(false, { owner: ["0x99"] }).input)).rejects.toThrow();
  await expect(inspectGameRoles(fixture(false, {}, "0x0").input)).rejects.toThrow();
});

test("resume reads every handed-off role and does not require the revoked bootstrap device", async () => {
  const sample = fixture(true, { owner: ["0x77"], launcher: ["0x88"], ledger_operator: ["0x99"] }, "0x0");
  const roles = await inspectGameRoles(sample.input);
  expect(roles.slice(1).map(({ address }) => address)).toEqual(["0x77", "0x88", "0x99"]);
  expect(sample.calls).not.toContain("is_device");
});

test("resume retains immutable authentication, VRF and nonzero-role checks", async () => {
  const invalid: Record<string, string[]>[] = [
    { authentication: ["0xa", "0x7"] },
    { vrf_public_key: ["0xb", "0xd"] },
    { l2_gas_bound: ["0x1"] },
    { ledger_operator: ["0x0"] },
  ];
  for (const views of invalid) await expect(inspectGameRoles(fixture(true, views).input)).rejects.toThrow();
});
