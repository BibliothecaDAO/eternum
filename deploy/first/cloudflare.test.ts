import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ADMIN_ACCESS } from "./admin-access";
import { setUpDirectory } from "./cloudflare";
import { PrivateStore } from "./private-store";
import { root, type Inputs } from "./settings";

const temporary: string[] = [];
afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const privateDirectory = () => {
  const directory = join(mkdtempSync(join(tmpdir(), "cloudflare-test-")), "private");
  temporary.push(directory);
  return { directory, store: new PrivateStore(directory, root, true) };
};
const inputs: Inputs = {
  cloudflareToken: "fake-cloudflare",
  rpc: "https://starknet-mainnet.g.alchemy.com/v2/throwaway",
  resend: "fake-resend",
  amount: "1000000",
  frontierStart: "2027-01-01T00:00:00Z",
  frontierEnd: "2027-01-21T00:00:00Z",
  blitzStart: "2027-01-01T00:00:00Z",
  blitzEnd: "2027-02-01T00:00:00Z",
};

test("publishing refuses a directory set up before the admin had Access, before anything deploys", () => {
  const { directory, store } = privateDirectory();
  expect(() => setUpDirectory(directory)).toThrow("Run setup before publishing Cloudflare");
  store.write("inputs.json", inputs);
  expect(() => setUpDirectory(directory)).toThrow("Admin access is not set up yet");
  store.write(ADMIN_ACCESS, { teamDomain: "realms.cloudflareaccess.com", audience: "aud", operators: [], writers: [] });
  expect(setUpDirectory(directory).inputs).toEqual(inputs);
});
