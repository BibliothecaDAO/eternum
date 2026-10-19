import { expect, it } from "vitest";
import { isDevShardChain } from "./dev-shard";

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
