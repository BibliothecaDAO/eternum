import { mkdtemp, chmod, rm, stat, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { loopbackUrl, privateWrite, readPrivate, readConfig } from "./config";

it("refuses public chains and credential-bearing URLs so the stand-in cannot reach a deployed chain", () => {
  for (const url of [
    "https://rpc.example.com",
    "http://127.0.0.1.example.com",
    "http://user:pass@localhost:5050",
    "file:///tmp/node",
  ])
    expect(() => loopbackUrl(url)).toThrow();
  expect(loopbackUrl("http://127.0.0.1:5050/rpc").port).toBe("5050");
});
it("creates private owned files without overwrite and refuses permissive credential input", async () => {
  const directory = await mkdtemp(join(tmpdir(), "value-stack-config-"));
  try {
    const path = join(directory, "credentials.json");
    await privateWrite(path, { value: "private-placeholder" });
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(await readPrivate(path)).toEqual({ value: "private-placeholder" });
    await expect(privateWrite(path, { value: "replacement" })).rejects.toThrow();
    expect(JSON.parse(await readFile(path, "utf8")).value).toBe("private-placeholder");
    await chmod(path, 0o644);
    await expect(readPrivate(path)).rejects.toThrow("private_file_must_be_owned_0600");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
it("validates the public config before starting any node or reading private inputs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "value-stack-config-"));
  try {
    const path = join(directory, "config.json");
    await privateWrite(path, {
      stateDirectory: directory,
      frontendDirectory: directory,
      port: 18443,
      devnetPort: 15050,
      shardRpcUrl: "https://mainnet.example/rpc",
      shardHeraldUrl: "http://localhost:8080",
      guardianKeyFile: "/tmp/g",
      launcherKeyFile: "/tmp/l",
      ledgerOperatorKeyFile: "/tmp/o",
      frontierGameId: 1,
    });
    await expect(readConfig(path)).rejects.toThrow("loopback_url_required");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("generates distinct native bot credentials bound to the local guardian, class and chain without replacing existing keys", async () => {
  const { generateKeys } = await import("./keys");
  const { deviceChangeHash, realmsAccountAddress } = await import("@realms-world/identity/account");
  const { ec } = await import("starknet");
  const directory = await mkdtemp(join(tmpdir(), "value-stack-keys-"));
  try {
    await generateKeys(directory, "0x1", "0x2");
    const guardian = await readPrivate<{ privateKey: string }>(join(directory, "guardian.json"));
    const bootstrap = await readPrivate<{
      guardianPublicKey: string;
      accounts: {
        name: string;
        realmsId: string;
        address: string;
        deviceKey: string;
        guardianApproval: [string, string];
      }[];
    }>(join(directory, "native-bootstrap.json"));
    expect(bootstrap.accounts[0]!.address).not.toBe(bootstrap.accounts[1]!.address);
    for (const bot of bootstrap.accounts) {
      expect(bot.address).toBe(realmsAccountAddress(bot.realmsId, "0x1", bootstrap.guardianPublicKey));
      const signature = new ec.starkCurve.Signature(BigInt(bot.guardianApproval[0]), BigInt(bot.guardianApproval[1]));
      const change = {
        chainId: "0x2",
        account: bot.address,
        action: "ADD" as const,
        deviceKey: bot.deviceKey,
        counter: 0,
      };
      expect(
        ec.starkCurve.verify(signature, deviceChangeHash(change), ec.starkCurve.getPublicKey(guardian.privateKey)),
      ).toBe(true);
      expect(
        ec.starkCurve.verify(
          signature,
          deviceChangeHash({ ...change, chainId: "0x3" }),
          ec.starkCurve.getPublicKey(guardian.privateKey),
        ),
      ).toBe(false);
    }
    await expect(generateKeys(directory, "0x1", "0x2")).rejects.toThrow();
    expect(JSON.stringify(await readPrivate(join(directory, "guardian.json"))) === JSON.stringify(guardian)).toBe(true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("refuses serving the private state tree as frontend assets", async () => {
  const directory = await mkdtemp(join(tmpdir(), "value-stack-asset-path-"));
  try {
    const path = join(directory, "config.json");
    await privateWrite(path, {
      stateDirectory: join(directory, "private"),
      frontendDirectory: directory,
      port: 18443,
      devnetPort: 15050,
      shardRpcUrl: "http://localhost:5050/rpc",
      shardHeraldUrl: "http://localhost:8080",
      guardianKeyFile: join(directory, "private/guardian.json"),
      launcherKeyFile: join(directory, "private/launcher.json"),
      ledgerOperatorKeyFile: join(directory, "private/ledger.json"),
      frontierGameId: 1,
    });
    await expect(readConfig(path)).rejects.toThrow("frontend_cannot_contain_private_state");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
