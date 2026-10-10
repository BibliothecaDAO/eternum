import { expect, it } from "vitest";

import { l2EnvironmentProblem } from "./l2-environment";

const SEPOLIA = "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_9/key";
const MAINNET = "https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_9/key";

it("takes only an https Alchemy endpoint for the network of the build's environment", () => {
  expect(l2EnvironmentProblem(undefined, SEPOLIA)).toBeNull();
  expect(l2EnvironmentProblem("staging", SEPOLIA)).toBeNull();
  expect(l2EnvironmentProblem("production", MAINNET)).toBeNull();
});

it("refuses a missing or public RPC, and an Alchemy endpoint for the other environment's network", () => {
  expect(l2EnvironmentProblem("staging", undefined)).toMatch(/VITE_PUBLIC_IDENTITY_RPC_URL/);
  expect(l2EnvironmentProblem("staging", "https://api.zan.top/public/starknet-sepolia")).toMatch(/Alchemy/);
  expect(l2EnvironmentProblem("staging", MAINNET)).toMatch(/SN_SEPOLIA/);
  expect(l2EnvironmentProblem("production", SEPOLIA)).toMatch(/SN_MAIN/);
  expect(l2EnvironmentProblem(undefined, MAINNET)).toMatch(/SN_SEPOLIA/);
  expect(l2EnvironmentProblem("staging", SEPOLIA.replace("https:", "http:"))).toMatch(/Alchemy/);
  expect(l2EnvironmentProblem("staging", "https://starknet-sepolia.g.alchemy.com/")).toMatch(/Alchemy/);
  expect(l2EnvironmentProblem("staging", "not a url")).toMatch(/Alchemy/);
});
