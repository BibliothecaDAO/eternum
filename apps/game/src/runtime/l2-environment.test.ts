import { expect, it } from "vitest";

import { l2EnvironmentProblem } from "./l2-environment";

const SEPOLIA = "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_9/key";
const MAINNET = "https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_9/key";

it("takes only an https Alchemy endpoint for the build's own network", () => {
  expect(l2EnvironmentProblem("SN_SEPOLIA", SEPOLIA)).toBeNull();
  expect(l2EnvironmentProblem("SN_MAIN", MAINNET)).toBeNull();
});

it("refuses a missing chain, a missing or public RPC, and an Alchemy endpoint for the other network", () => {
  expect(l2EnvironmentProblem(undefined, SEPOLIA)).toMatch(/VITE_PUBLIC_L2_CHAIN is required/);
  expect(l2EnvironmentProblem("SN_GOERLI", SEPOLIA)).toMatch(/VITE_PUBLIC_L2_CHAIN is required/);
  expect(l2EnvironmentProblem("SN_SEPOLIA", undefined)).toMatch(/VITE_PUBLIC_IDENTITY_RPC_URL/);
  expect(l2EnvironmentProblem("SN_SEPOLIA", "https://api.zan.top/public/starknet-sepolia")).toMatch(/Alchemy/);
  expect(l2EnvironmentProblem("SN_SEPOLIA", MAINNET)).toMatch(/SN_SEPOLIA/);
  expect(l2EnvironmentProblem("SN_MAIN", SEPOLIA)).toMatch(/SN_MAIN/);
  expect(l2EnvironmentProblem("SN_SEPOLIA", SEPOLIA.replace("https:", "http:"))).toMatch(/Alchemy/);
  expect(l2EnvironmentProblem("SN_SEPOLIA", "https://starknet-sepolia.g.alchemy.com/")).toMatch(/Alchemy/);
  expect(l2EnvironmentProblem("SN_SEPOLIA", "not a url")).toMatch(/Alchemy/);
});
