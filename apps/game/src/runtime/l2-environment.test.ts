import { expect, it } from "vitest";

import { l2EnvironmentProblem } from "./l2-environment";

const MAINNET = "https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_9/key";
const SEPOLIA = "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_9/key";

it("takes only an https Alchemy endpoint for Starknet mainnet, the L2 of the dev and the production book alike", () => {
  expect(l2EnvironmentProblem(undefined, MAINNET)).toBeNull();
  expect(l2EnvironmentProblem("staging", MAINNET)).toBeNull();
  expect(l2EnvironmentProblem("production", MAINNET)).toBeNull();
});

it("refuses a missing or public RPC, and an Alchemy endpoint for another network, in a dev build too", () => {
  expect(l2EnvironmentProblem("staging", undefined)).toMatch(/VITE_PUBLIC_IDENTITY_RPC_URL/);
  expect(l2EnvironmentProblem("staging", "https://api.zan.top/public/starknet-mainnet")).toMatch(/Alchemy/);
  // No build is on Sepolia: its endpoint is refused by the name of the chain the book gives.
  expect(l2EnvironmentProblem("staging", SEPOLIA)).toMatch(/SN_MAIN/);
  expect(l2EnvironmentProblem(undefined, SEPOLIA)).toMatch(/SN_MAIN/);
  expect(l2EnvironmentProblem("production", SEPOLIA)).toMatch(/SN_MAIN/);
  expect(l2EnvironmentProblem("staging", MAINNET.replace("https:", "http:"))).toMatch(/Alchemy/);
  expect(l2EnvironmentProblem("staging", "https://starknet-mainnet.g.alchemy.com/")).toMatch(/Alchemy/);
  expect(l2EnvironmentProblem("staging", "not a url")).toMatch(/Alchemy/);
});
