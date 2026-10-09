import { createServer } from "node:http";
import { createHash } from "node:crypto";
import type { Duplex } from "node:stream";
import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";
import { ec } from "starknet";
import { buildBundles } from "./bundle";
import { startIdentity, startWorkers, type Manifest } from "./workers";

it("runs the actual Workers together with D1, private local email and named bindings, without hosting any external endpoint", async () => {
  const directory = await mkdtemp(join(tmpdir(), "value-stack-workers-"));
  const server = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify(request.url === "/manifest" ? manifest : { chain: "0x1", confirmed_block: 0, games: [] }),
    );
  });
  const sockets = new Set<Duplex>();
  server.on("upgrade", (request, socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    const accept = createHash("sha1")
      .update(String(request.headers["sec-websocket-key"]) + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
      .digest("base64");
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    const payload = Buffer.from("confirmed-stream");
    socket.write(Buffer.concat([Buffer.from([0x81, payload.length]), payload]));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test_server_not_listening");
  const herald = `http://127.0.0.1:${address.port}`;
  const key = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(31))).toString("hex")}`;
  const manifest: Manifest = {
    version: 1,
    chainId: "0x1",
    accountClassHash: "0x1",
    guardianPublicKey: ec.starkCurve.getStarkKey(key),
    rpcUrl: herald + "/rpc",
    contracts: { games: "0x77" },
    releaseSchemas: {},
    l2GasBound: "0x47868c00",
  };
  let workers: Awaited<ReturnType<typeof startWorkers>> | undefined;
  try {
    await mkdir(join(directory, "frontend"));
    await writeFile(join(directory, "frontend", "index.html"), "<!doctype html><p>Local client fixture</p>");
    await buildBundles(resolve(import.meta.dirname, "../../.."), join(directory, "bundles"));
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-days",
        "1",
        "-keyout",
        join(directory, "tls.key"),
        "-out",
        join(directory, "tls.crt"),
        "-subj",
        "/CN=localhost",
      ],
      { stdio: "ignore" },
    );
    const input = {
      root: resolve(import.meta.dirname, "../../.."),
      config: {
        stateDirectory: directory,
        frontendDirectory: join(directory, "frontend"),
        port: 0,
        devnetPort: address.port,
        shardRpcUrl: herald + "/rpc",
        shardHeraldUrl: herald,
        guardianKeyFile: "/unused",
        launcherKeyFile: "/unused",
        ledgerOperatorKeyFile: "/unused",
        frontierGameId: 1,
      },
      manifest,
      assets: { ledger: "0x10", lords: "0x11", mmr: "0x12", chests: "0x13", cosmetics: "0x14", realms: "0x15" },
      accounts: [
        { address: "0x1", private_key: key },
        { address: "0x2", private_key: key },
        { address: "0x3", private_key: key },
      ],
      secrets: {
        operatorToken: "local-test-operator",
        authSecret: crypto.randomUUID() + crypto.randomUUID(),
        vapid: { publicKey: "unused", privateKey: "unused" },
      },
      guardianKey: key,
      launcher: { address: "0xa", privateKey: key },
      operator: { address: "0xb", privateKey: key },
    };
    workers = await startIdentity(input);
    const db = await workers.mf.getD1Database("DB", "identity");
    expect((await db.prepare("SELECT COUNT(*) AS count FROM shards").first<{ count: number }>())!.count).toBe(0);
    const guardian = await workers.mf.dispatchFetch(workers.origin + "/api/guardian");
    expect(guardian.status).toBe(200);
    expect((await workers.mf.dispatchFetch(workers.origin + "/local-value.json")).status).toBe(503);
    workers = await startWorkers(input, workers.mf);
    const request = (path: string, body?: unknown, token?: string) =>
      workers!.mf.dispatchFetch(workers!.origin + path, {
        method: body ? "POST" : "GET",
        headers: {
          origin: workers!.origin,
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    const guardianResponse = await request("/api/guardian");
    expect(await guardianResponse.clone().text()).toMatch(/^\{/);
    expect(((await guardianResponse.json()) as { publicKey: string }).publicKey).toBe(manifest.guardianPublicKey);
    expect(
      (await request("/api/directory/shards/pending", { url: workers.origin }, "local-test-operator")).status,
    ).toBe(201);
    expect(((await (await request("/api/directory")).json()) as { shards: unknown[] }).shards).toEqual([]);
    expect((await request("/api/directory/shards", { url: workers.origin }, "local-test-operator")).status).toBe(201);
    expect(((await (await request("/api/directory")).json()) as { shards: unknown[] }).shards).toHaveLength(1);
    expect((await request("/api/operator/monitor/reset", { reason: "rehearsal" })).status).toBe(401);
    expect((await request("/api/operator/monitor/reset", { reason: "rehearsal" }, "local-test-operator")).status).toBe(
      200,
    );
    expect(
      (await request("/api/auth/email-otp/send-verification-otp", { email: "player@localhost.test", type: "sign-in" }))
        .status,
    ).toBe(200);
    const inbox = await readdir(join(directory, "inbox"));
    expect(inbox).toHaveLength(1);
    const email = JSON.parse(await readFile(join(directory, "inbox", inbox[0]!), "utf8")) as { text: string };
    const code = email.text.match(/\b\d{6}\b/)![0];
    expect((await request("/api/auth/sign-in/email-otp", { email: "player@localhost.test", otp: code })).status).toBe(
      200,
    );
    const stream = await workers.mf.dispatchFetch(workers.origin + "/games/1", { headers: { upgrade: "websocket" } });
    expect(stream.status).toBe(101);
    const socket = stream.webSocket!;
    const message = new Promise<string>((resolve) =>
      socket.addEventListener("message", (event) => resolve(String(event.data)), { once: true }),
    );
    socket.accept();
    expect(await message).toBe("confirmed-stream");
    socket.close();
    expect(await (await request("/")).text()).toContain("Local client fixture");
    expect(((await (await request("/local-value.json")).json()) as { ledger: string }).ledger).toBe("0x10");
    expect((await request("/health/relay")).status).toBe(503);
    expect((await request("/health/monitor")).status).toBe(503);
  } finally {
    if (workers) await workers.mf.dispose();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(directory, { recursive: true, force: true });
  }
}, 120000);
