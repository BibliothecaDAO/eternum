import { readdirSync, readFileSync } from "node:fs";
import { buildSiwsMessage, enrolOperator } from "@realms-world/identity";
import { botRealmsId, deviceChangeHash, realmsAccountAddress } from "@realms-world/identity/account";
import { createGuardian } from "@realms-world/guardian";
import { byteArray, CallData, ec, hash, typedData, type TypedData } from "starknet";
import { getPlatformProxy } from "wrangler";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createIdentityAuth } from "./auth";
import type { VerifyWalletSignature } from "./siws-plugin";
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

/** The email provider's inbox: the last sign-in code sent to each address. */
const sentCodes = new Map<string, string>();
/** Sign-in codes requested per address, as the rate limiter counts them. */
const codesRequested = new Map<string, number>();
const countSignInCode = (email: string) => {
  codesRequested.set(email, (codesRequested.get(email) ?? 0) + 1);
  return codesRequested.get(email)!;
};

/** Mainnet wallets by address: each signs the SIWS message's SNIP-12 hash with its own Stark key. */
const walletKeys = new Map<string, string>();
const createWallet = (): string => {
  const privateKey = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(31))).toString("hex")}`;
  const address = ec.starkCurve.getStarkKey(privateKey);
  // An address is below 2^251; a key's x-coordinate occasionally is not.
  if (BigInt(address) >= 2n ** 251n) return createWallet();
  walletKeys.set(BigInt(address).toString(16), privateKey);
  return address;
};
// The wallet contract's own check runs on mainnet; this one checks the same signature over the same message hash.
const verifyAsMainnet: VerifyWalletSignature = async (message, signature, address) => {
  const privateKey = walletKeys.get(BigInt(address).toString(16));
  if (!privateKey || signature.length !== 2) return false;
  const hash = typedData.getMessageHash(message as unknown as TypedData, address);
  return ec.starkCurve.verify(
    new ec.starkCurve.Signature(BigInt(signature[0]!), BigInt(signature[1]!)),
    hash,
    ec.starkCurve.getPublicKey(privateKey),
  );
};

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
    OPERATOR_TOKEN: OPERATOR_TOKEN,
    DISCORD_CLIENT_ID: "discord-client",
    DISCORD_CLIENT_SECRET: "discord-secret",
    RESEND_API_KEY: "unused",
    WEB_PUSH_VAPID_PUBLIC_KEY: "unused",
    WEB_PUSH_VAPID_PRIVATE_KEY: "unused",
    WEB_PUSH_VAPID_SUBJECT: "mailto:ops@realms.party",
    SHARD_NOTIFIER_POLL_MS: 3_000,
    SHARD_NOTIFIER: {} as IdentityEnv["SHARD_NOTIFIER"],
    CHAT_ROOM: {} as IdentityEnv["CHAT_ROOM"],
    CHAT_INBOX: {} as IdentityEnv["CHAT_INBOX"],
    DB: proxy.env.DB,
    GUARDIAN: createGuardian(GUARDIAN_KEY),
    PUBLIC_RATE_LIMIT: { limit: async () => ({ success: true }) },
    SIGN_IN_CODE_RATE_LIMIT: { limit: async ({ key }) => ({ success: countSignInCode(key) <= 3 }) },
    VERSION: { id: "test", tag: "", timestamp: "" },
  };
  auth = createIdentityAuth(env, {
    verifyWalletSignature: verifyAsMainnet,
    sendSignInCode: async (email, code) => void sentCodes.set(email, code),
  });
}, 60_000);

afterAll(() => proxy?.dispose());

/** A shard manifest under our guardian and account class, the only kind our directory lists. */
const shardManifest = (chainId: string) => ({
  chainId,
  accountClassHash: ACCOUNT_CLASS_HASH,
  guardianPublicKey: ec.starkCurve.getStarkKey(GUARDIAN_KEY),
});

/**
 * A browser: one cookie jar, first-party requests to the app's /api. `parentDomainCookies` are cookies another
 * realms.party service set for the whole domain; the browser sends them first.
 */
const createBrowser = (parentDomainCookies: string[] = []) => {
  const cookies = new Map<string, string>();
  const request = async (path: string, init: { method?: string; body?: unknown; token?: string } = {}) => {
    const response = await routeIdentityRequest(
      new Request(`${ORIGIN}${path}`, {
        method: init.method ?? (init.body === undefined ? "GET" : "POST"),
        headers: {
          origin: ORIGIN,
          "content-type": "application/json",
          cookie: [...parentDomainCookies, ...[...cookies].map(([name, value]) => `${name}=${value}`)].join("; "),
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
      user: { id: string; name: string; realmsId: string; address?: string | null; suggestedName?: string | null };
    } | null;
  return { request, session };
};

/** Proves a wallet to the identity service, to link it or to recover the account it is linked to. */
const proveWallet = async (browser: ReturnType<typeof createBrowser>, address: string, path: "link") => {
  const { nonce } = (await (await browser.request("/api/auth/siws/nonce", { body: { address } })).json()) as {
    nonce: string;
  };
  const message = buildSiwsMessage({ address, chainId: "SN_MAIN", domain: new URL(ORIGIN).host, nonce, uri: ORIGIN });
  const { r, s } = ec.starkCurve.sign(
    typedData.getMessageHash(message as unknown as TypedData, address),
    walletKeys.get(BigInt(address).toString(16))!,
  );
  return browser.request(`/api/auth/siws/${path}`, {
    body: { message: JSON.stringify(message), signature: [`0x${r.toString(16)}`, `0x${s.toString(16)}`], address },
  });
};

/** A signed-in player who linked a wallet from the account page. */
const playerWithWallet = async (email: string) => {
  const browser = createBrowser();
  await signInWithCode(browser, email);
  const wallet = createWallet();
  expect((await proveWallet(browser, wallet, "link")).status).toBe(200);
  const linked = (await browser.session())!.user;
  expect(BigInt(linked.address ?? 0)).toBe(BigInt(wallet));
  return { wallet, userId: linked.id };
};

/** Asks for a sign-in code and signs in with it, as the sign-in screen does. */
const signInWithCode = async (browser: ReturnType<typeof createBrowser>, email: string) => {
  const sent = await browser.request("/api/auth/email-otp/send-verification-otp", { body: { email, type: "sign-in" } });
  expect(sent.status).toBe(200);
  return browser.request("/api/auth/sign-in/email-otp", { body: { email, otp: sentCodes.get(email.toLowerCase()) } });
};

/** Discord's OAuth and user endpoints, answering for the profiles the test registers by authorization code. */
const discordProfiles = new Map<string, { id: string; username: string; email: string; verified: boolean }>();
const fakeDiscord = () => {
  const passThrough = globalThis.fetch;
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.hostname !== "discord.com") return passThrough(input, init);
    if (url.pathname === "/api/oauth2/token") {
      const code = new URLSearchParams(await request.text()).get("code");
      return Response.json({
        access_token: `token-${code}`,
        token_type: "Bearer",
        expires_in: 604_800,
        scope: "identify email",
      });
    }
    const profile = discordProfiles.get(request.headers.get("authorization")?.replace("Bearer token-", "") ?? "");
    return profile
      ? Response.json({ ...profile, global_name: null, avatar: null, discriminator: "0" })
      : new Response("unauthorized", { status: 401 });
  });
};

/** Starts Discord sign-in and returns from Discord with an authorization code for this profile. */
const signInWithDiscord = async (
  browser: ReturnType<typeof createBrowser>,
  profile: { id: string; username: string; email: string; verified: boolean },
) => {
  const started = (await (
    await browser.request("/api/auth/sign-in/social", { body: { provider: "discord", callbackURL: "/account" } })
  ).json()) as { url: string };
  const code = `code-${profile.id}`;
  discordProfiles.set(code, profile);
  const state = new URL(started.url).searchParams.get("state");
  return browser.request(`/api/auth/callback/discord?code=${code}&state=${state}`);
};

const userCount = async () =>
  ((await proxy.env.DB.prepare('SELECT count(*) AS n FROM "user"').first()) as { n: number }).n;

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

  it("keeps a new session when another realms.party service's session cookie is sent first", async () => {
    const browser = createBrowser(["__Secure-better-auth.session_token=another-service.c2lnbmF0dXJl"]);
    expect((await signInWithCode(browser, "shadowed@realms.test")).status).toBe(200);
    expect((await browser.session())?.user.realmsId).toBeTruthy();
  });

  it("creates an account on an email's first sign-in with a code, and signs the same account in after", async () => {
    const before = await userCount();
    const first = createBrowser();
    expect((await signInWithCode(first, "lord@realms.test")).status).toBe(200);
    const created = await first.session();
    expect(created?.user.realmsId).toBe(realmsIdOf(created!.user.id));

    const second = createBrowser();
    expect((await signInWithCode(second, "LORD@realms.test")).status).toBe(200);
    expect((await second.session())?.user.id).toBe(created?.user.id);
    expect(await userCount()).toBe(before + 1);
  });

  it("refuses a wrong code, an expired code and a code after three wrong tries", async () => {
    const browser = createBrowser();
    const signIn = (email: string, otp: string | undefined) =>
      browser.request("/api/auth/sign-in/email-otp", { body: { email, otp } });
    const ask = (email: string) =>
      browser.request("/api/auth/email-otp/send-verification-otp", { body: { email, type: "sign-in" } });

    await ask("wrong@realms.test");
    const wrongCode = sentCodes.get("wrong@realms.test") === "000000" ? "111111" : "000000";
    expect((await signIn("wrong@realms.test", wrongCode)).status).toBe(400);

    await ask("late@realms.test");
    await proxy.env.DB.prepare('UPDATE "verification" SET "expiresAt" = ? WHERE "identifier" LIKE ?')
      .bind(new Date(Date.now() - 1_000).toISOString(), "%late@realms.test")
      .run();
    expect((await signIn("late@realms.test", sentCodes.get("late@realms.test"))).status).toBe(400);

    await ask("guess@realms.test");
    for (let attempt = 0; attempt < 3; attempt += 1) await signIn("guess@realms.test", "999999");
    const afterGuesses = await signIn("guess@realms.test", sentCodes.get("guess@realms.test"));
    expect(afterGuesses.status).not.toBe(200);
    expect(await browser.session()).toBeNull();
  });

  it("sends an address only a few sign-in codes a minute", async () => {
    const browser = createBrowser();
    const ask = (email: string) =>
      browser.request("/api/auth/email-otp/send-verification-otp", { body: { email, type: "sign-in" } });
    for (let code = 0; code < 3; code += 1) expect((await ask("busy@realms.test")).status).toBe(200);
    const refused = await ask("busy@realms.test");
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({ error: "too_many_codes" });
    expect((await ask("quiet@realms.test")).status).toBe(200);
  });

  it("creates an account on a Discord user's first sign-in, and signs the same account in after", async () => {
    const discord = fakeDiscord();
    try {
      const before = await userCount();
      const profile = { id: "80351110224678912", username: "nelly", email: "nelly@discord.test", verified: true };
      const first = createBrowser();
      const returned = await signInWithDiscord(first, profile);
      expect(returned.status).toBe(302);
      expect(returned.headers.get("location")).toContain("/account");
      const created = await first.session();
      expect(created?.user.realmsId).toBe(realmsIdOf(created!.user.id));

      const second = createBrowser();
      await signInWithDiscord(second, profile);
      expect((await second.session())?.user.id).toBe(created?.user.id);
      expect(await userCount()).toBe(before + 1);
    } finally {
      discord.mockRestore();
    }
  });

  it("refuses a device approval without a session", async () => {
    const response = await createBrowser().request("/api/devices", { body: deviceChangeFor(realmsIdOf("anyone")) });
    expect(response.status).toBe(401);
  });

  it("refuses a device approval to an account without a verified sign-in", async () => {
    const browser = createBrowser();
    await signInWithCode(browser, "unverified@realms.test");
    const user = (await browser.session())!.user;
    // An account from before Discord and email codes were the only ways in.
    await proxy.env.DB.prepare('UPDATE "user" SET "emailVerified" = 0 WHERE "id" = ?').bind(user.id).run();
    const refused = await browser.request("/api/devices", { body: deviceChangeFor(user.realmsId) });
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ error: "account_not_secured" });
  });

  it("approves only a verified account's own exact change, and never re-adds a revoked key", async () => {
    const browser = createBrowser();
    expect((await signInWithCode(browser, "approver@realms.test")).status).toBe(200);
    const after = await browser.session();

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

    // A revoked key never comes back, on any shard, even after a fresh sign-in.
    const revoked = { ...requested, action: "REVOKE" as const, counter: 5 };
    expect((await browser.request("/api/devices", { body: revoked })).status).toBe(200);
    const signedInAgain = createBrowser();
    await signInWithCode(signedInAgain, "approver@realms.test");
    const readd = await signedInAgain.request("/api/devices", { body: { ...requested, chainId: "0x1", counter: 6 } });
    expect(readd.status).toBe(403);
    expect(await readd.json()).toEqual({ error: "device_revoked" });
    const newDevice = { ...requested, deviceKey: "0x3ab1ca", counter: 6 };
    expect((await signedInAgain.request("/api/devices", { body: newDevice })).status).toBe(200);
  });

  it("signs a removed browser out, so its next approval request is refused, while the device that removed it stays", async () => {
    const removed = createBrowser();
    await signInWithCode(removed, "removed-device@realms.test");
    const realmsId = (await removed.session())!.user.realmsId;
    const kept = createBrowser();
    await signInWithCode(kept, "removed-device@realms.test");
    const oldKey = deviceChangeFor(realmsId, { counter: 1 });
    expect((await removed.request("/api/devices", { body: oldKey })).status).toBe(200);
    const keptKey = deviceChangeFor(realmsId, { counter: 2 });
    expect((await kept.request("/api/devices", { body: { ...keptKey, deviceKey: "0x4b0b" } })).status).toBe(200);

    const removal = { ...oldKey, action: "REVOKE" as const, counter: 3 };
    expect((await kept.request("/api/devices", { body: removal })).status).toBe(200);

    // The removed browser still holds its cookie; it mints a new key and asks for that key's approval.
    const freshKey = { ...oldKey, deviceKey: "0x5eed1e", counter: 4 };
    expect((await removed.request("/api/devices", { body: freshKey })).status).toBe(401);
    expect(await removed.session()).toBeNull();
    expect((await kept.request("/api/devices", { body: freshKey })).status).toBe(200);
  });

  it("approves only a bot's first device, only for the operator and only on the account its label places", async () => {
    const guardianPublicKey = ec.starkCurve.getStarkKey(GUARDIAN_KEY);
    const botAccount = realmsAccountAddress(botRealmsId("0xb07"), ACCOUNT_CLASS_HASH, guardianPublicKey);
    const change = {
      chainId: CHAIN_ID,
      account: botAccount,
      action: "ADD" as const,
      deviceKey: "0xb0d1ce",
      counter: 1,
    };
    const request = { label: "0xb07", ...change };
    const operator = createBrowser();
    const ask = (body: unknown, token?: string) =>
      operator.request("/api/devices/bots", token === undefined ? { body } : { body, token });

    expect((await ask(request)).status).toBe(401);
    expect((await ask(request, "not-the-operator-token")).status).toBe(401);

    const approval = (await (await ask(request, OPERATOR_TOKEN)).json()) as { signature: [string, string] };
    const [r, s] = approval.signature;
    expect(
      ec.starkCurve.verify(
        new ec.starkCurve.Signature(BigInt(r), BigInt(s)),
        deviceChangeHash(change),
        ec.starkCurve.getPublicKey(GUARDIAN_KEY),
      ),
    ).toBe(true);

    // A shard's operator is the bot its deployer address labels, and the Games authority. Once it has its first device,
    // the token can add no second device to it and revoke none: a leaked token cannot take the authority over.
    const deployerLabel = "0x2f1a6c0de";
    const operatorAccount = realmsAccountAddress(botRealmsId(deployerLabel), ACCOUNT_CLASS_HASH, guardianPublicKey);
    const operatorChange = { ...request, label: deployerLabel, account: operatorAccount };
    for (const later of [
      { ...operatorChange, deviceKey: "0xa77ac4", counter: 2 },
      { ...operatorChange, action: "REVOKE" as const, counter: 2 },
    ]) {
      const refusedLater = await ask(later, OPERATOR_TOKEN);
      expect(refusedLater.status).toBe(403);
      expect(await refusedLater.json()).toEqual({ error: "bot_first_device_only" });
    }

    // A signed-in player's account, asked for under any label, is not a bot's.
    const player = createBrowser();
    await signInWithCode(player, "not-a-bot@realms.test");
    const playerAccount = deviceChangeFor((await player.session())!.user.realmsId).account;
    const refused = await ask({ ...request, account: playerAccount }, OPERATOR_TOKEN);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ error: "not_a_bot_account" });
    expect((await ask({ ...request, action: "REVOKE", account: playerAccount }, OPERATOR_TOKEN)).status).toBe(403);
  });

  it("enrols a community shard's operator through their own Realms account, then signs that session out", async () => {
    const email = "community-operator@realms.test";
    const deviceKey = "0x0be7a702";
    const guardianPublicKey = ec.starkCurve.getStarkKey(GUARDIAN_KEY);
    const inProcess = (url: string, init?: RequestInit) =>
      routeIdentityRequest(new Request(url, init), env, auth, {
        cache: proxy.caches.default as unknown as Cache,
        fetchShard,
      });

    const enrolment = await enrolOperator({
      identityUrl: `${ORIGIN}/api`,
      shard: { chainId: CHAIN_ID, accountClassHash: ACCOUNT_CLASS_HASH, guardianPublicKey },
      deviceKey,
      email,
      readCode: async () => sentCodes.get(email)!,
      fetch: inProcess,
    });

    const user = (await proxy.env.DB.prepare('SELECT "id", "realmsId" FROM "user" WHERE "email" = ?')
      .bind(email)
      .first()) as { id: string; realmsId: string };
    expect(enrolment.realmsId).toBe(user.realmsId);
    const [r, s] = enrolment.signature;
    const approved = {
      chainId: CHAIN_ID,
      account: realmsAccountAddress(user.realmsId, ACCOUNT_CLASS_HASH, guardianPublicKey),
      action: "ADD" as const,
      deviceKey,
      counter: 1,
    };
    expect(
      ec.starkCurve.verify(
        new ec.starkCurve.Signature(BigInt(r!), BigInt(s!)),
        deviceChangeHash(approved),
        ec.starkCurve.getPublicKey(GUARDIAN_KEY),
      ),
    ).toBe(true);
    const sessions = await proxy.env.DB.prepare('SELECT count(*) AS n FROM "session" WHERE "userId" = ?')
      .bind(user.id)
      .first<{ n: number }>();
    expect(sessions?.n).toBe(0);
  });

  it("names an account only through our guardian's approval, never through the Realms id it claims", async () => {
    const browser = createBrowser();
    await signInWithCode(browser, "galen@realms.test");
    expect((await browser.request("/api/auth/update-user", { body: { name: "Ser Galen" } })).status).toBe(200);
    const realmsId = (await browser.session())!.user.realmsId;
    const approved = deviceChangeFor(realmsId, { counter: 1 });
    expect((await browser.request("/api/devices", { body: approved })).status).toBe(200);

    // Anyone can deploy an account under their own guardian that claims this Realms id; it gets no name.
    const impostor = realmsAccountAddress(realmsId, ACCOUNT_CLASS_HASH, ec.starkCurve.getStarkKey("0x5eed"));
    const stranger = createBrowser();
    const response = await stranger.request(`/api/profiles?accounts=${approved.account},${impostor}`);
    expect(await response.json()).toEqual({ profiles: { [approved.account]: { name: "Ser Galen", portrait: null } } });

    const tooMany = Array.from({ length: 201 }, (_, index) => `0x${(index + 1).toString(16)}`).join(",");
    expect((await stranger.request(`/api/profiles?accounts=${tooMany}`)).status).toBe(400);
  });

  it("saves preferences by revision, caps devices per account and revokes a device only with its token", async () => {
    const browser = createBrowser();
    await signInWithCode(browser, "preferences@realms.test");
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

  it("lists each shard's live games under that shard, settled ones in a paged history, with a player's standing when asked, names a shard it cannot read, and refuses a listed chain id or another guardian's shard", async () => {
    const operator = createBrowser();
    const game = (gameId: number, name: string) => ({ game_id: gameId, name, status: "Running" });
    heralds.set("https://shard-a.test/manifest", shardManifest("0xa"));
    heralds.set("https://shard-a.test/games", { chain: "0xa", games: [game(1, "frontier-a")] });
    heralds.set("https://shard-b.test/manifest", shardManifest("0xb"));
    heralds.set("https://shard-c.test/manifest", shardManifest("0x0a"));

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
    // A shard whose accounts sit under another guardian would place the same player at another address.
    heralds.set("https://shard-f.test/manifest", { ...shardManifest("0xf"), guardianPublicKey: "0x5eed" });
    const foreign = await operator.request("/api/directory/shards", {
      body: { url: "https://shard-f.test" },
      token: OPERATOR_TOKEN,
    });
    expect(await foreign.json()).toEqual({ error: "account_identity_differs" });

    const list = async (query = "") =>
      ((await (await createBrowser().request(`/api/directory${query}`)).json()) as { shards: unknown[] }).shards;
    expect(await list()).toEqual([
      { url: "https://shard-a.test", chainId: "0xa", status: "active", games: [game(1, "frontier-a")] },
      { url: "https://shard-b.test", chainId: "0xb", status: "active", games: null, error: "unavailable" },
    ]);

    heralds.set("https://shard-b.test/games", { chain: "0xb", games: [game(1, "blitz-b")] });
    const listed = [
      { url: "https://shard-a.test", chainId: "0xa", status: "active", games: [game(1, "frontier-a")] },
      { url: "https://shard-b.test", chainId: "0xb", status: "active", games: [game(1, "blitz-b")] },
    ];
    expect(await list()).toEqual(listed);

    // A player's standing comes from each shard as it answers that player; shard B cannot answer, and says so.
    const standing = { registered: true, settled: false, roster_member: false, structures: [] };
    heralds.set("https://shard-a.test/games?player=0xabc", {
      chain: "0xa",
      games: [{ ...game(1, "frontier-a"), player_state: standing }],
    });
    expect(await list("?player=0xabc")).toEqual([
      { ...listed[0], games: [{ ...game(1, "frontier-a"), player_state: standing }] },
      { url: "https://shard-b.test", chainId: "0xb", status: "active", games: null, error: "unavailable" },
    ]);
    expect(await list()).toEqual(listed);
    expect((await createBrowser().request("/api/directory?player=nobody")).status).toBe(400);

    // A settled game leaves the live list; the history serves it, newest end first across shards, a page at a time.
    const settled = (gameId: number, name: string, endAt: number) => ({
      ...game(gameId, name),
      status: "Settled",
      clock: { end_at: endAt },
    });
    const live = { ...game(1, "blitz-d"), clock: { end_at: 900 } };
    heralds.set("https://shard-d.test/manifest", shardManifest("0xd"));
    heralds.set("https://shard-d.test/games", { chain: "0xd", games: [live, settled(2, "blitz-d-old", 200)] });
    heralds.set("https://shard-e.test/manifest", shardManifest("0xe"));
    heralds.set("https://shard-e.test/games", {
      chain: "0xe",
      games: [settled(1, "e-first", 100), settled(2, "e-last", 300)],
    });
    for (const url of ["https://shard-d.test", "https://shard-e.test"]) {
      expect((await operator.request("/api/directory/shards", { body: { url }, token: OPERATOR_TOKEN })).status).toBe(
        201,
      );
    }
    expect(await list()).toEqual([
      ...listed,
      { url: "https://shard-d.test", chainId: "0xd", status: "active", games: [live] },
      { url: "https://shard-e.test", chainId: "0xe", status: "active", games: [] },
    ]);
    const history = async (query: string) =>
      (await (await createBrowser().request(`/api/directory/history${query}`)).json()) as {
        games: { name: string; chainId: string; shardUrl: string }[];
        next: string | null;
        failures: { url: string }[];
      };
    const first = await history("?limit=2");
    expect(first.games.map(({ name, chainId, shardUrl }) => [name, chainId, shardUrl])).toEqual([
      ["e-last", "0xe", "https://shard-e.test"],
      ["blitz-d-old", "0xd", "https://shard-d.test"],
    ]);
    expect(first.next).toBe("200:0xd:2");
    const second = await history(`?limit=2&cursor=${first.next}`);
    expect(second.games.map(({ name }) => name)).toEqual(["e-first"]);
    expect(second.next).toBeNull();
    expect(second.failures).toEqual([]);

    // With a player, only the games they entered; a shard that cannot answer that player is named.
    heralds.set("https://shard-e.test/games?player=0xabc", {
      chain: "0xe",
      games: [
        { ...settled(1, "e-first", 100), player_state: { ...standing, registered: false } },
        { ...settled(2, "e-last", 300), player_state: standing },
      ],
    });
    const mine = await history("?player=0xabc");
    expect(mine.games.map(({ name }) => name)).toEqual(["e-last"]);
    expect(mine.failures.map(({ url }) => url)).toEqual(["https://shard-b.test", "https://shard-d.test"]);
    for (const query of ["?limit=0", "?limit=101", "?cursor=bogus", "?player=nobody"]) {
      expect((await createBrowser().request(`/api/directory/history${query}`)).status).toBe(400);
    }

    // A live shard's URL cannot take a new chain; once retired, it is listed again under the chain its manifest names.
    heralds.set("https://shard-e.test/manifest", shardManifest("0xee"));
    heralds.set("https://shard-e.test/games", { chain: "0xee", games: [live] });
    const admitE = () =>
      operator.request("/api/directory/shards", { body: { url: "https://shard-e.test" }, token: OPERATOR_TOKEN });
    expect(await (await admitE()).json()).toEqual({ error: "shard_listed" });
    const retired = await operator.request("/api/directory/shards/status", {
      body: { url: "https://shard-e.test", status: "retired" },
      token: OPERATOR_TOKEN,
    });
    expect(retired.status).toBe(200);
    const relisted = await admitE();
    expect(relisted.status).toBe(201);
    expect(await relisted.json()).toEqual({ url: "https://shard-e.test", chainId: "0xee" });
    expect((await list()).at(-1)).toEqual({
      url: "https://shard-e.test",
      chainId: "0xee",
      status: "active",
      games: [live],
    });
  });

  it("refuses to link a wallet that already belongs to another Realms account", async () => {
    const { wallet } = await playerWithWallet("holder@realms.test");

    const other = createBrowser();
    await signInWithCode(other, "other@realms.test");
    const refused = await proveWallet(other, wallet, "link");
    expect(refused.status).toBe(409);
    expect(((await refused.json()) as { message: string }).message).toBe("WALLET_LINKED_ELSEWHERE");
    expect((await other.session())?.user.address ?? null).toBeNull();
  });

  it("reads the account from the database on every session, whichever device changed it", async () => {
    const firstDevice = createBrowser();
    await signInWithCode(firstDevice, "two-devices@realms.test");
    const secondDevice = createBrowser();
    await signInWithCode(secondDevice, "two-devices@realms.test");
    expect((await secondDevice.session())?.user.address ?? null).toBeNull();

    const wallet = createWallet();
    expect((await proveWallet(firstDevice, wallet, "link")).status).toBe(200);
    // The second device signed in before the link; linking the same wallet there is the account's own wallet.
    expect((await proveWallet(secondDevice, wallet, "link")).status).toBe(200);
    for (const device of [firstDevice, secondDevice]) {
      expect(BigInt((await device.session())?.user.address ?? 0)).toBe(BigInt(wallet));
    }

    expect((await firstDevice.request("/api/auth/update-user", { body: { name: "Two Devices" } })).status).toBe(200);
    expect((await secondDevice.session())?.user.name).toBe("Two Devices");
  });

  it("keeps one wallet per account: unlinking frees it, and a new link replaces the account's wallet", async () => {
    const { wallet: first } = await playerWithWallet("first-holder@realms.test");
    const holder = createBrowser();
    await signInWithCode(holder, "first-holder@realms.test");
    const other = createBrowser();
    await signInWithCode(other, "second-holder@realms.test");
    expect((await proveWallet(other, first, "link")).status).toBe(409);

    expect((await holder.request("/api/auth/siws/unlink", { body: {} })).status).toBe(200);
    expect((await holder.session())?.user.address ?? null).toBeNull();
    expect((await proveWallet(other, first, "link")).status).toBe(200);

    const second = createWallet();
    expect((await proveWallet(other, second, "link")).status).toBe(200);
    expect(BigInt((await other.session())?.user.address ?? 0)).toBe(BigInt(second));
    expect((await proveWallet(holder, first, "link")).status).toBe(200);
  });

  it("suggests a new player's display name from their Discord name or their email", async () => {
    const byEmail = createBrowser();
    await signInWithCode(byEmail, "ser.galen+play@realms.test");
    expect((await byEmail.session())?.user.suggestedName).toBe("sergalenplay");

    const discord = fakeDiscord();
    try {
      const byDiscord = createBrowser();
      await signInWithDiscord(byDiscord, {
        id: "80351110224678913",
        username: "nelly_b",
        email: "x@discord.test",
        verified: true,
      });
      expect((await byDiscord.session())?.user.suggestedName).toBe("nelly_b");
    } finally {
      discord.mockRestore();
    }
  });

  it("offers no way in but Discord and an emailed code", async () => {
    const stranger = createBrowser();
    for (const path of ["/api/auth/sign-in/anonymous", "/api/auth/siws/verify", "/api/auth/siws/recover"]) {
      expect((await stranger.request(path, { body: {} })).status).toBe(404);
    }
    expect((await stranger.request("/api/auth/passkey/generate-authenticate-options")).status).toBe(404);
    expect(await stranger.session()).toBeNull();
  });
});

// The proof that no bot shares a player's Realms id is domain separation, not a search: a player's id is Poseidon over a
// serialized ByteArray, which is never fewer than three felts ([data_len, ...data, pending_word, pending_word_len]),
// and a bot's is Poseidon over exactly two, ['REALMS_BOT', label]. Distinct inputs, so a shared id would be a Poseidon
// collision. This test pins both input shapes so a change to either derivation breaks it.
describe("bot and player Realms ids", () => {
  it("are derived from inputs of different lengths, so they never coincide", () => {
    for (const userId of ["", "a", crypto.randomUUID().replaceAll("-", ""), "x".repeat(31), "x".repeat(62)]) {
      expect(CallData.compile(byteArray.byteArrayFromString(userId)).length).toBeGreaterThanOrEqual(3);
    }
    const tag = `0x${Buffer.from("REALMS_BOT").toString("hex")}`;
    expect(botRealmsId("0xb07")).toBe(`0x${BigInt(hash.computePoseidonHashOnElements([tag, "0xb07"])).toString(16)}`);
    expect(botRealmsId("0xb07")).not.toBe(realmsIdOf("0xb07"));
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
