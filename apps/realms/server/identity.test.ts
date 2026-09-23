import { readdirSync, readFileSync } from "node:fs";
import { isoBase64URL, isoCBOR } from "@simplewebauthn/server/helpers";
import { buildSiwsMessage } from "@realms-world/identity";
import { deviceChangeHash, realmsAccountAddress } from "@realms-world/identity/account";
import { createGuardian } from "@realms-world/guardian";
import { ec } from "starknet";
import { getPlatformProxy } from "wrangler";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createIdentityAuth } from "./auth";
import type { IdentityEnv } from "./env";
import { realmsIdOf } from "./realms-id";
import { routeIdentityRequest } from "./routes";

const ORIGIN = "https://staging.realms.party";
const ACCOUNT_CLASS_HASH = "0x68995feeefffc1647118073e1ff16179f07eb8eed6c8fb03cce73109f5fbacd";
const GUARDIAN_KEY = "0x2dccce1da22003777062ee0870e9881b460a8b7eca276870f57c601f182136c";
const CHAIN_ID = "0x5245414c4d535f53484152445f41";

let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
const OPERATOR_TOKEN = "operator-test-token";

/** The Heralds this test's shards answer from, by URL; a missing entry answers 503. */
const heralds = new Map<string, unknown>();
const fetchShard = (async (input: RequestInfo | URL) => {
  const body = heralds.get(new URL(input instanceof Request ? input.url : input).href);
  return body === undefined ? new Response("unavailable", { status: 503 }) : Response.json(body);
}) as typeof fetch;
let env: IdentityEnv;
let auth: ReturnType<typeof createIdentityAuth>;

beforeAll(async () => {
  proxy = await getPlatformProxy<{ DB: D1Database }>({ environment: "staging", persist: false });
  const migrations = new URL("../migrations/", import.meta.url);
  const statements = readdirSync(migrations)
    .sort()
    .map((file) => readFileSync(new URL(file, migrations), "utf8"))
    .join(";\n")
    .replace(/^--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  await proxy.env.DB.batch(statements.map((statement) => proxy.env.DB.prepare(statement)));
  env = {
    ENVIRONMENT: "staging",
    BASE_URL: ORIGIN,
    ACCOUNT_CLASS_HASH,
    BETTER_AUTH_SECRET: "identity-test-secret-identity-test-secret",
    IDENTITY_RPC_URL: "http://127.0.0.1:1",
    DIRECTORY_ADMIN_TOKEN: OPERATOR_TOKEN,
    WEB_PUSH_VAPID_PUBLIC_KEY: "unused",
    WEB_PUSH_VAPID_PRIVATE_KEY: "unused",
    WEB_PUSH_VAPID_SUBJECT: "mailto:ops@realms.party",
    SHARD_NOTIFIER: {} as IdentityEnv["SHARD_NOTIFIER"],
    CHAT_ROOM: {} as IdentityEnv["CHAT_ROOM"],
    CHAT_INBOX: {} as IdentityEnv["CHAT_INBOX"],
    DB: proxy.env.DB,
    GUARDIAN: createGuardian(GUARDIAN_KEY),
    PUBLIC_RATE_LIMIT: { limit: async () => ({ success: true }) },
    VERSION: { id: "test", tag: "", timestamp: "" },
  };
  // The wallet contract's own signature check runs on mainnet; everything after it is under test.
  auth = createIdentityAuth(env, async () => true);
}, 60_000);

afterAll(() => proxy?.dispose());

/** A browser: one cookie jar, first-party requests to the app's /api. */
const createBrowser = () => {
  const cookies = new Map<string, string>();
  const request = async (path: string, init: { method?: string; body?: unknown; token?: string } = {}) => {
    const response = await routeIdentityRequest(
      new Request(`${ORIGIN}${path}`, {
        method: init.method ?? (init.body === undefined ? "GET" : "POST"),
        headers: {
          origin: ORIGIN,
          "content-type": "application/json",
          cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; "),
          ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      }),
      env,
      auth,
      { cache: proxy.caches.default as unknown as Cache, fetchShard },
    );
    for (const header of response.headers.getSetCookie()) {
      const [pair = ""] = header.split(";");
      const separator = pair.indexOf("=");
      cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    return response;
  };
  const session = async () =>
    (await (await request("/api/auth/get-session")).json()) as {
      user: { id: string; realmsId: string; address?: string | null };
    } | null;
  return { request, session };
};

const signInWithWallet = async (browser: ReturnType<typeof createBrowser>, address: string, path = "verify") => {
  const { nonce } = (await (await browser.request("/api/auth/siws/nonce", { body: { address } })).json()) as {
    nonce: string;
  };
  const message = buildSiwsMessage({ address, chainId: "SN_MAIN", domain: new URL(ORIGIN).host, nonce, uri: ORIGIN });
  return browser.request(`/api/auth/siws/${path}`, {
    body: { message: JSON.stringify(message), signature: ["0x1", "0x2"], address },
  });
};

/** A platform authenticator with a P-256 key, answering one registration ceremony with a "none" attestation. */
const registerPasskey = async (browser: ReturnType<typeof createBrowser>) => {
  const options = (await (await browser.request("/api/auth/passkey/generate-register-options")).json()) as {
    challenge: string;
  };
  const keys = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
  ])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", keys.publicKey)) as JsonWebKey;
  const publicKey = isoCBOR.encode(
    new Map<number, number | Uint8Array>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, isoBase64URL.toBuffer(jwk.x!)],
      [-3, isoBase64URL.toBuffer(jwk.y!)],
    ]),
  );
  const credentialId = crypto.getRandomValues(new Uint8Array(16));
  const rpIdHash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode("staging.realms.party")),
  );
  const authData = new Uint8Array([
    ...rpIdHash,
    0x45, // user present, user verified, attested credential data
    0,
    0,
    0,
    0,
    ...new Uint8Array(16),
    0,
    credentialId.length,
    ...credentialId,
    ...publicKey,
  ]);
  const clientDataJSON = new Uint8Array(
    new TextEncoder().encode(JSON.stringify({ type: "webauthn.create", challenge: options.challenge, origin: ORIGIN })),
  );
  const attestationObject = isoCBOR.encode(
    new Map<string, unknown>([
      ["fmt", "none"],
      ["attStmt", new Map()],
      ["authData", authData],
    ]) as never,
  );
  const id = isoBase64URL.fromBuffer(credentialId);
  return browser.request("/api/auth/passkey/verify-registration", {
    body: {
      response: {
        id,
        rawId: id,
        type: "public-key",
        clientExtensionResults: {},
        response: {
          clientDataJSON: isoBase64URL.fromBuffer(clientDataJSON),
          attestationObject: isoBase64URL.fromBuffer(attestationObject),
          transports: ["internal"],
        },
      },
    },
  });
};

const deviceChangeFor = (realmsId: string, overrides: Partial<{ account: string; counter: number }> = {}) => ({
  chainId: CHAIN_ID,
  account: realmsAccountAddress(realmsId, ACCOUNT_CLASS_HASH, ec.starkCurve.getStarkKey(GUARDIAN_KEY)),
  action: "ADD" as const,
  deviceKey: "0x3ab1c9",
  counter: 1,
  ...overrides,
});

describe("identity Worker", () => {
  it("publishes the guardian key and account class a shard's manifest must carry", async () => {
    const published = await (await createBrowser().request("/api/guardian")).json();
    expect(published).toEqual({
      publicKey: ec.starkCurve.getStarkKey(GUARDIAN_KEY),
      accountClassHash: ACCOUNT_CLASS_HASH,
    });
  });

  it("refuses a device approval without a session", async () => {
    const response = await createBrowser().request("/api/devices", { body: deviceChangeFor(realmsIdOf("anyone")) });
    expect(response.status).toBe(401);
  });

  it("keeps the anonymous user when its passkey is added, and approves only its own account's exact change", async () => {
    const browser = createBrowser();
    expect((await browser.request("/api/auth/sign-in/anonymous", { body: {} })).status).toBe(200);
    const before = await browser.session();
    expect(before?.user.realmsId).toBe(realmsIdOf(before!.user.id));

    const unsecured = await browser.request("/api/devices", { body: deviceChangeFor(before!.user.realmsId) });
    expect(unsecured.status).toBe(403);

    expect((await registerPasskey(browser)).status).toBe(200);
    const after = await browser.session();
    expect(after?.user.id).toBe(before?.user.id);
    expect(after?.user.realmsId).toBe(before?.user.realmsId);

    const fieldPrime = `0x${(2n ** 251n + 17n * 2n ** 192n + 1n).toString(16)}`;
    const unreduced = { ...deviceChangeFor(after!.user.realmsId), deviceKey: fieldPrime };
    expect((await browser.request("/api/devices", { body: unreduced })).status).toBe(400);

    const someoneElse = deviceChangeFor(realmsIdOf("someone-else"));
    expect((await browser.request("/api/devices", { body: someoneElse })).status).toBe(403);

    const requested = deviceChangeFor(after!.user.realmsId, { counter: 4 });
    const approval = (await (await browser.request("/api/devices", { body: requested })).json()) as {
      signature: [string, string];
    };
    const [r, s] = approval.signature;
    const guardianKey = ec.starkCurve.getPublicKey(GUARDIAN_KEY);
    expect(
      ec.starkCurve.verify(new ec.starkCurve.Signature(BigInt(r), BigInt(s)), deviceChangeHash(requested), guardianKey),
    ).toBe(true);
    for (const altered of [
      { ...requested, counter: 5 },
      { ...requested, action: "REVOKE" as const },
      { ...requested, deviceKey: "0x3ab1ca" },
      { ...requested, chainId: "0x1" },
    ]) {
      expect(
        ec.starkCurve.verify(new ec.starkCurve.Signature(BigInt(r), BigInt(s)), deviceChangeHash(altered), guardianKey),
      ).toBe(false);
    }
  });

  it("saves preferences by revision, caps devices per account and revokes a device only with its token", async () => {
    const browser = createBrowser();
    await browser.request("/api/auth/sign-in/anonymous", { body: {} });
    const owner = (await browser.session())!.user.realmsId;

    const save = (revision: number) =>
      browser.request("/api/notifications/preferences", { body: { owner, level: "important", revision } });
    expect(((await (await save(0)).json()) as { revision: number }).revision).toBe(1);
    expect((await save(0)).status).toBe(409);

    const device = (index: number) => {
      const id = `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
      const subscription = {
        endpoint: `https://fcm.googleapis.com/fcm/send/device-${index}`,
        keys: { p256dh: "B".repeat(87), auth: "A".repeat(22) },
      };
      return { owner, id, token: id.replace("4000", "4001"), subscription };
    };
    for (let index = 0; index < 10; index++) {
      expect((await browser.request("/api/notifications/push/subscribe", { body: device(index) })).status).toBe(200);
    }
    const eleventh = await browser.request("/api/notifications/push/subscribe", { body: device(10) });
    expect(await eleventh.json()).toEqual({ error: "subscription_limit" });

    const first = device(0);
    const status = async () =>
      (
        (await (await browser.request("/api/notifications/push/status", { body: { owner, id: first.id } })).json()) as {
          registered: boolean;
        }
      ).registered;
    await createBrowser().request("/api/notifications/push/revoke", { body: { id: first.id, token: device(1).token } });
    expect(await status()).toBe(true);
    await createBrowser().request("/api/notifications/push/revoke", { body: { id: first.id, token: first.token } });
    expect(await status()).toBe(false);
  });

  it("lists each shard's games under that shard, names a shard it cannot read, and refuses a listed chain id", async () => {
    const operator = createBrowser();
    const game = (gameId: number, name: string) => ({ game_id: gameId, name, status: "Running" });
    heralds.set("https://shard-a.test/manifest", { chainId: "0xa" });
    heralds.set("https://shard-a.test/games", { chain: "0xa", games: [game(1, "frontier-a")] });
    heralds.set("https://shard-b.test/manifest", { chainId: "0xb" });
    heralds.set("https://shard-c.test/manifest", { chainId: "0x0a" });

    expect((await operator.request("/api/directory/shards", { body: { url: "https://shard-a.test" } })).status).toBe(
      401,
    );
    for (const url of ["https://shard-a.test", "https://shard-b.test"]) {
      const admitted = await operator.request("/api/directory/shards", { body: { url }, token: OPERATOR_TOKEN });
      expect(admitted.status).toBe(201);
    }
    const duplicate = await operator.request("/api/directory/shards", {
      body: { url: "https://shard-c.test" },
      token: OPERATOR_TOKEN,
    });
    expect(await duplicate.json()).toEqual({ error: "chain_id_listed", url: "https://shard-a.test" });

    const list = async () =>
      ((await (await createBrowser().request("/api/directory")).json()) as { shards: unknown[] }).shards;
    expect(await list()).toEqual([
      { url: "https://shard-a.test", chainId: "0xa", status: "active", games: [game(1, "frontier-a")] },
      { url: "https://shard-b.test", chainId: "0xb", status: "active", games: null, error: "unavailable" },
    ]);

    heralds.set("https://shard-b.test/games", { chain: "0xb", games: [game(1, "blitz-b")] });
    expect(await list()).toEqual([
      { url: "https://shard-a.test", chainId: "0xa", status: "active", games: [game(1, "frontier-a")] },
      { url: "https://shard-b.test", chainId: "0xb", status: "active", games: [game(1, "blitz-b")] },
    ]);
  });

  it("refuses to link a wallet that already belongs to another Realms account", async () => {
    const wallet = "0x0456";
    expect((await signInWithWallet(createBrowser(), wallet)).status).toBe(200);

    const other = createBrowser();
    await other.request("/api/auth/sign-in/anonymous", { body: {} });
    const refused = await signInWithWallet(other, wallet, "link");
    expect(refused.status).toBe(409);
    expect(((await refused.json()) as { message: string }).message).toBe("WALLET_LINKED_ELSEWHERE");
    expect((await other.session())?.user.address ?? null).toBeNull();
  });
});

// Computed by the RealmsAccount crate (snforge: poseidon over the serialized ByteArray, device_change_hash, and
// deploy_syscall from zero), so a change on either side fails here.
describe("the account's own arithmetic", () => {
  it("agrees with Cairo on the Realms id, the guardian message and the account address", () => {
    const realmsId = realmsIdOf("0x5a3c");
    expect(realmsId).toBe("0x734aaebc35ab0e92e58e896fd0ba9cbd02df71fb4eeac417c062061bfeb4c27");
    expect(
      deviceChangeHash({ chainId: CHAIN_ID, account: "0x1234", action: "REVOKE", deviceKey: "0xabc", counter: 7 }),
    ).toBe("0x6391ae16e59af5b3e7a103409189beb1ef6ac55e4a9e2c0e02898f6b7cb390a");
    expect(realmsAccountAddress(realmsId, ACCOUNT_CLASS_HASH, ec.starkCurve.getStarkKey(GUARDIAN_KEY))).toBe(
      "0x3e6f9c39817718ef8deb75b935d22a0b4fb9c5e97899395b5ed07e70df3656",
    );
  });
});
