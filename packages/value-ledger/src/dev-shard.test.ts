import { expect, it } from "vitest";
import { isDevShardChain, isOtherEnvironmentChain, shardEnvironmentOf } from "./dev-shard";

const chainOf = (name: string) => `0x${[...name].map((char) => char.charCodeAt(0).toString(16)).join("")}`;

it.each([
  ["the live dev shard", "0x4445565f31386465333133316136653930626337", true],
  ["a dev chain the deploy names", chainOf("DEV_1a2b3c"), true],
  ["a production chain the deploy names", chainOf("PRODUCTION_1a2b3c"), false],
  ["a chain that only mentions dev later", chainOf("PROD_DEV_1"), false],
  ["Starknet mainnet", chainOf("SN_MAIN"), false],
  ["a value that is not a felt", "DEV_1", false],
])("reads %s", (_case, chainId, dev) => {
  expect(isDevShardChain(chainId as string)).toBe(dev);
});

it.each([
  ["dev's own shard", "staging", chainOf("DEV_1a2b3c"), false],
  ["production's shard, from dev", "staging", chainOf("PRODUCTION_1a2b3c"), true],
  ["dev's shard, from production", "production", chainOf("DEV_1a2b3c"), true],
  ["production's own shard", "production", chainOf("PRODUCTION_1a2b3c"), false],
  ["a chain neither deploy named, from dev", "staging", chainOf("SN_MAIN"), false],
  ["a chain neither deploy named, from production", "production", "0x1", false],
] as const)("treats %s as the other environment's: %s", (_case, environment, chainId, other) => {
  expect(isOtherEnvironmentChain(environment, chainId)).toBe(other);
});

it("names the environment of every chain the shard deploy can name, and none other", () => {
  expect(shardEnvironmentOf(chainOf("DEV_18dfa7f2b475f083"))).toBe("staging");
  expect(shardEnvironmentOf(chainOf("PRODUCTION_18e0000000000000"))).toBe("production");
  expect(shardEnvironmentOf(chainOf("PROD_DEV_1"))).toBeNull();
  expect(shardEnvironmentOf("DEV_1")).toBeNull();
});
