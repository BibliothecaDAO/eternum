import { expect, test } from "bun:test";
import { shortString } from "starknet";
import { isOfficialChain } from "./measurement-launcher";

test("only a chain named after a deployment environment counts as an official shard", () => {
  const named = (name: string) => shortString.encodeShortString(name);
  for (const [name, official] of [
    ["DEV_18de3131a6e90bc7", true],
    ["PRODUCTION_18de3131a6e9", true],
    ["IL_KNEE_60_12_141708", false],
    ["OPS_KNEE500_20261008", false],
    ["PROD_DEV_1", false],
  ] as const)
    expect([name, isOfficialChain(named(name))]).toEqual([name, official]);
});
