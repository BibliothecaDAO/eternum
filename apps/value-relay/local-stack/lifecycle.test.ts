import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, chmod, writeFile, readFile, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import { generateKeys } from "./keys";
import { buildBundles } from "./bundle";
import { privateWrite, readPrivate } from "./config";

it("cleans its own created container and process record after an asset startup failure without printing credentials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "value-stack-lifecycle-"));
  const bootstrap = join(directory, "bootstrap");
  await generateKeys(bootstrap, "0x1", "0x2");
  const native = await readPrivate<{ guardianPublicKey: string }>(join(bootstrap, "native-bootstrap.json"));
  const wallet = await readPrivate<{ privateKey: string }>(join(bootstrap, "launcher.json"));
  const server = createServer(async (request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.url === "/manifest")
      return response.end(
        JSON.stringify({
          version: 1,
          chainId: "0x2",
          accountClassHash: "0x1",
          guardianPublicKey: native.guardianPublicKey,
          contracts: { games: "0x77" },
          releaseSchemas: {},
          l2GasBound: "0x47868c00",
          rpcUrl: url + "/rpc",
        }),
      );
    if (request.url === "/predeployed_accounts")
      return response.end(
        JSON.stringify([1, 2, 3].map((index) => ({ address: `0x${index}`, private_key: wallet.privateKey }))),
      );
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const rpc = JSON.parse(Buffer.concat(chunks).toString()) as { id: number; method: string };
    const result =
      rpc.method === "starknet_specVersion"
        ? "0.10.0"
        : rpc.method === "starknet_chainId"
          ? "0x2"
          : rpc.method === "starknet_getClassHashAt"
            ? "0x1"
            : rpc.method === "starknet_call"
              ? ["0x56414c4944"]
              : null;
    response.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: rpc.id,
        ...(result === null ? { error: { code: 40, message: "rehearsal_fixture_refuses_deployment" } } : { result }),
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture_server_unavailable");
  const url = `http://127.0.0.1:${address.port}`;
  try {
    const bin = join(directory, "bin");
    await mkdir(bin);
    const log = join(directory, "docker-commands.txt");
    const docker = join(bin, "docker");
    await writeFile(
      docker,
      '#!/bin/sh\nprintf "%s\\n" "$1" >> "$VALUE_STACK_DOCKER_TRACE"\nif [ "$1" = ps ]; then printf "abcdef012345\\n"; fi\n',
    );
    await chmod(docker, 0o700);
    const bundles = join(directory, "bundles");
    await buildBundles(resolve(import.meta.dirname, "../../.."), bundles);
    const flock = join(bin, "flock");
    await writeFile(flock, '#!/bin/sh\nmkdir -p "$4"\ncp -R "$VALUE_STACK_BUNDLES/." "$4/"\n');
    await chmod(flock, 0o700);
    await mkdir(join(directory, "frontend"));
    await writeFile(join(directory, "frontend/index.html"), "<!doctype html><p>Rehearsal</p>");
    const config = join(directory, "config.json");
    const state = join(directory, "state");
    await privateWrite(config, {
      stateDirectory: state,
      frontendDirectory: join(directory, "frontend"),
      port: address.port === 18443 ? 18444 : 18443,
      devnetPort: address.port,
      shardRpcUrl: url + "/rpc",
      shardHeraldUrl: url,
      guardianKeyFile: join(bootstrap, "guardian.json"),
      launcherKeyFile: join(bootstrap, "launcher.json"),
      ledgerOperatorKeyFile: join(bootstrap, "ledger-operator.json"),
      frontierGameId: 1,
    });
    const failure = await promisify(execFile)(process.execPath, ["--import", "tsx", "local-stack/up.ts", config], {
      cwd: resolve(import.meta.dirname, ".."),
      env: {
        ...process.env,
        PATH: bin + ":" + process.env.PATH,
        VALUE_STACK_DOCKER_TRACE: log,
        VALUE_STACK_BUNDLES: bundles,
      },
    }).then(
      () => null,
      (error) => error as { stderr: string; stdout: string; code: number },
    );
    expect(failure?.code).toBe(1);
    expect(failure?.stderr).toContain("ledger_deployment");
    expect((failure!.stderr + failure!.stdout).includes(wallet.privateKey)).toBe(false);
    expect((await readFile(log, "utf8")).trim().split("\n")).toEqual(["create", "start", "ps", "rm"]);
    await expect(stat(state)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);
