import { expect, it } from "bun:test";
import { join } from "node:path";

it("joins each bot on the private node and hands back an account that plays through the public RPC", async () => {
  const script = `
    import { mock } from "bun:test";
    const joins = [];
    mock.module("@bibliothecadao/eternum", () => ({
      DeviceSigner: class { constructor(device) { this.device = device; } },
      deviceKeyOf: (privateKey) => ({ publicKey: "0x2", privateKey }),
      joinBotAccount: async (input) => {
        joins.push(input.provider);
        return { address: "0x3" + joins.length };
      },
    }));
    mock.module("@bibliothecadao/eternum/game-client", () => ({ configureGameplayAccountSubmits: (account) => account }));
    const { createHarnessAccounts } = await import(${JSON.stringify(join(import.meta.dir, "account-factory.ts"))});
    const { RpcProvider } = await import("starknet");
    const setupProvider = new RpcProvider({ nodeUrl: "http://madara:9944/rpc/v0_10_2" });
    const playProvider = new RpcProvider({ nodeUrl: "http://rpc:8080/rpc/v0_10_2" });
    const accounts = await createHarnessAccounts({
      count: 2, gameId: 1, setupProvider, playProvider, shard: {}, identity: { operatorToken: "fixture" },
    });
    console.log(JSON.stringify({
      joinedOn: joins.map((provider) => provider.channel.nodeUrl),
      playsThrough: accounts.map(({ account }) => account.channel.nodeUrl),
      addresses: accounts.map(({ address }) => address),
      signedByItsDevice: accounts.every(({ account, privateKey }) => account.signer.device.privateKey === privateKey),
    }));
  `;
  expect(await runAccountFixture(script)).toEqual({
    joinedOn: Array(2).fill("http://madara:9944/rpc/v0_10_2"),
    playsThrough: Array(2).fill("http://rpc:8080/rpc/v0_10_2"),
    addresses: ["0x31", "0x32"],
    signedByItsDevice: true,
  });
});

it("retries a bot whose sign-in dropped with a fresh account", async () => {
  const script = `
    import { mock } from "bun:test";
    const joins = [];
    mock.module("@bibliothecadao/eternum", () => ({
      DeviceSigner: class { constructor(device) { this.device = device; } },
      deviceKeyOf: (privateKey) => ({ publicKey: "0x2", privateKey }),
      joinBotAccount: async (input) => {
        joins.push(input.label);
        if (joins.length === 1) throw new TypeError("The socket connection was closed unexpectedly");
        return { address: "0x3" + joins.length };
      },
    }));
    mock.module("@bibliothecadao/eternum/game-client", () => ({ configureGameplayAccountSubmits: (account) => account }));
    const { createHarnessAccounts } = await import(${JSON.stringify(join(import.meta.dir, "account-factory.ts"))});
    const { RpcProvider } = await import("starknet");
    const provider = new RpcProvider({ nodeUrl: "http://madara:9944/rpc/v0_10_2" });
    const accounts = await createHarnessAccounts({
      count: 1, gameId: 1, setupProvider: provider, playProvider: provider, shard: {}, identity: { operatorToken: "fixture" },
    });
    console.log(JSON.stringify({ attempts: joins.length, freshLabel: joins[0] !== joins[1], addresses: accounts.map(({ address }) => address) }));
  `;
  expect(await runAccountFixture(script)).toEqual({ attempts: 2, freshLabel: true, addresses: ["0x32"] });
});

/** Runs a fixture script in its own process, so its module mocks stay out of the other tests. */
async function runAccountFixture(script: string): Promise<unknown> {
  const child = Bun.spawn(
    [process.execPath, "--tsconfig-override", join(import.meta.dir, "tsconfig.json"), "-e", script],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const deadline = setTimeout(() => child.kill(), 8_000);
  try {
    const [code, output, error] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    if (code !== 0) throw new Error(`Account fixture exited ${code}: ${error}`);
    return JSON.parse(output.trim().split("\n").at(-1)!);
  } finally {
    clearTimeout(deadline);
    child.kill();
  }
}
