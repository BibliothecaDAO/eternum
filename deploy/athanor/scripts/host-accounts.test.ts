import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, statSync, chmodSync, unlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { initializeHostAccounts, ensureShardVrfKey } from "./host-accounts";

const root = resolve(import.meta.dir, "../../..");
const ACCOUNT_CLASS_HASH = "0xe2eb8f5672af4e6a4e8a8f1b44989685e668489b0a25437733756c5a34a1d6";
const CHAIN_ID = "0x534841524441";

// A node that answers only what the host-account step reads; every other method is an error the step would report.
function startNode(classAtDeployer: string) {
  const methods: string[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const { id, method } = (await request.json()) as { id: number; method: string };
      methods.push(method);
      if (method === "starknet_chainId") return Response.json({ jsonrpc: "2.0", id, result: CHAIN_ID });
      if (method === "starknet_getClassHashAt") return Response.json({ jsonrpc: "2.0", id, result: classAtDeployer });
      return Response.json({ jsonrpc: "2.0", id, error: { code: -32601, message: `unexpected ${method}` } });
    },
  });
  return { server, methods };
}

async function deployHostAccount(rpcUrl: string) {
  const data = mkdtempSync(join(tmpdir(), "host-accounts-"));
  writeFileSync(
    join(data, "host-keys.json"),
    JSON.stringify({ deployerAddress: "0x789", deployerPrivateKey: "0xabc", sequencingPrivateKey: "0xdef" }),
  );
  writeFileSync(join(data, "native-world.json"), JSON.stringify({ shard: { chainId: CHAIN_ID } }));
  const child = Bun.spawn([process.execPath, "deploy/athanor/scripts/host-accounts.ts", "deploy", data], {
    cwd: root,
    env: { RPC_URL: rpcUrl, NATIVE_WORLD_MANIFEST: join(data, "native-world.json") },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [status, output, error] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { status, output, error };
}

describe("the host-account step of a first initialization", () => {
  let node: ReturnType<typeof startNode> | undefined;
  afterEach(() => node?.server.stop(true));

  test("keeps an account an interrupted initialization already deployed", async () => {
    node = startNode(ACCOUNT_CLASS_HASH);
    const { status, output } = await deployHostAccount(node.server.url.href);
    expect(status).toBe(0);
    expect(output).toContain("host_account_present");
    expect(node.methods.filter((method) => method.startsWith("starknet_add"))).toEqual([]);
  });

  test("refuses an address that holds another class", async () => {
    node = startNode("0x1234");
    const { status, error } = await deployHostAccount(node.server.url.href);
    expect(status).not.toBe(0);
    expect(error).toContain("holds another class");
  });
});

test("deployment creates an independent private VRF key and resumes it without any operator input", () => {
  const first = mkdtempSync(join(tmpdir(), "spike-host-one-")),
    second = mkdtempSync(join(tmpdir(), "spike-host-community-"));
  try {
    initializeHostAccounts(first);
    initializeHostAccounts(second);
    const host = JSON.parse(readFileSync(join(first, "host-keys.json"), "utf8")),
      file = join(first, "vrf-private.key"),
      key = readFileSync(file, "utf8");
    expect(key.trim() === host.deployerPrivateKey).toBe(false);
    expect(key.trim() === host.sequencingPrivateKey).toBe(false);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(statSync(join(first, "host-keys.json")).mode & 0o777).toBe(0o600);
    const publicKey = ensureShardVrfKey(first);
    expect(readFileSync(file, "utf8") === key).toBe(true);
    expect(JSON.parse(readFileSync(join(first, "host-accounts.json"), "utf8")).vrfPublicKey).toEqual(publicKey);
    expect(ensureShardVrfKey(second).join() === publicKey.join()).toBe(false);
    chmodSync(file, 0o644);
    expect(() => ensureShardVrfKey(first)).toThrow("private");
    chmodSync(file, 0o600);
    unlinkSync(file);
    expect(() => ensureShardVrfKey(first)).toThrow("Missing previously registered VRF key");
  } finally {
    rmSync(first, { recursive: true });
    rmSync(second, { recursive: true });
  }
});
