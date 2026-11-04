import { environmentL2 } from "@realms-world/chain";
import { readdirSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  buildSiwsMessage,
  normalizeStarknetAddress,
  payoutWalletStatement,
  type IdentityChainId,
} from "@realms-world/identity";
import { botRealmsId, deviceChangeHash, realmsAccountAddress } from "@realms-world/identity/account";
import { createGuardian } from "@realms-world/guardian";
import { byteArray, CallData, ec, hash, typedData, type TypedData } from "starknet";
import { getPlatformProxy } from "wrangler";
import { afterAll, beforeAll, describe, expect, it, onTestFinished, vi } from "vitest";

import { Effect } from "effect";
import { deliverWalletNotices } from "./wallet-changes";
import { createIdentityAuth } from "./auth";
import { WalletNotDeployedError, type VerifyWalletSignature } from "./wallet-signature";
import { ACCOUNT_CLASS_HASH, type IdentityEnv } from "./env";
import { realmsIdOf } from "./realms-id";
import { routeIdentityRequest } from "./routes";
import { campaignCodeHash } from "./campaigns";
import { CAMPAIGNS } from "@realms-world/identity";
import { campaignTicketFor } from "./campaign-ticket-store";
import { createCampaignReferralStore } from "./campaign-referral-store";
import { accountKey } from "./campaign-entry";
import { ORIGIN } from "./workerd-harness";
import { sendCampaign, stillFits, visitRecord } from "../scripts/comeback-campaign";

const GUARDIAN_KEY = "0x2dccce1da22003777062ee0870e9881b460a8b7eca276870f57c601f182136c";
const CHAIN_ID = "0x5245414c4d535f53484152445f41";

const storageDirectory = mkdtempSync(join(tmpdir(), "identity-platform-"));
let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
const OPERATOR_TOKEN = "operator-test-token";

/** The Heralds this test's shards answer from, by URL; a missing entry answers 503, and STALLED never answers. */
const heralds = new Map<string, unknown>();
const STALLED = Symbol("stalled");
let launchDirectory: {
  chains: { chainId: string; games: { gameId: number; slotId: number | null }[] }[];
} = { chains: [] };
const fetchShard = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const body = heralds.get(new URL(input instanceof Request ? input.url : input).href);
  if (body === STALLED)
    return new Promise<Response>((_, reject) =>
      init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)),
    );
  return body === undefined ? new Response("unavailable", { status: 503 }) : Response.json(body);
}) as typeof fetch;
/** The value relay's golden upgrade route, as identity calls it through its service binding. */
const relay = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
  Response.json({ campaign: "devcon-2026", tier: "golden" }),
);
let env: IdentityEnv;
let auth: ReturnType<typeof createIdentityAuth>;

/** The email provider's inbox: the last sign-in code sent to each address. */
const sentCodes = new Map<string, string>();
const notices = vi.fn(async (_email: string, _address: string | null, _id: string) => {});
/** Sign-in codes requested per address, as the rate limiter counts them. */
const codesRequested = new Map<string, number>();
const countSignInCode = (email: string) => {
  codesRequested.set(email, (codesRequested.get(email) ?? 0) + 1);
  return codesRequested.get(email)!;
};

/** Environment-chain wallets by address: each signs the SIWS message's SNIP-12 hash with its own Stark key. */
const walletKeys = new Map<string, string>();
const createWallet = (): string => {
  const privateKey = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(31))).toString("hex")}`;
  const address = ec.starkCurve.getStarkKey(privateKey);
  // An address is below 2^251; a key's x-coordinate occasionally is not.
  if (BigInt(address) >= 2n ** 251n) return createWallet();
  walletKeys.set(BigInt(address).toString(16), privateKey);
  return address;
};
// The wallet contract's own check runs on its configured chain; this one checks the same signature over the same message hash.
const verifyAsWallet = vi.fn<VerifyWalletSignature>(async (message, signature, address) => {
  const privateKey = walletKeys.get(BigInt(address).toString(16));
  if (!privateKey || signature.length !== 2) return false;
  const hash = typedData.getMessageHash(message as unknown as TypedData, address);
  return ec.starkCurve.verify(
    new ec.starkCurve.Signature(BigInt(signature[0]!), BigInt(signature[1]!)),
    hash,
    ec.starkCurve.getPublicKey(privateKey),
  );
});

beforeAll(async () => {
  vi.stubEnv("TMPDIR", storageDirectory);
  const configPath = join(storageDirectory, "wrangler.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      name: "identity-route-storage",
      compatibility_date: "2026-07-30",
      d1_databases: [{ binding: "DB", database_name: "identity", database_id: "00000000-0000-0000-0000-000000000000" }],
    }),
  );
  proxy = await getPlatformProxy<{ DB: D1Database }>({ configPath, persist: false });
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
    BETTER_AUTH_SECRET: "identity-test-secret-identity-test-secret",
    RATING_READER: {} as IdentityEnv["RATING_READER"],
    MARKETPLACE_API_URL: "https://market.test/api/marketplace",
    L2_RPC_URL: "https://starknet-mainnet.g.alchemy.com/v2/test",
    OPERATOR_TOKEN: OPERATOR_TOKEN,
    DISCORD_CLIENT_ID: "discord-client",
    DISCORD_CLIENT_SECRET: "discord-secret",
    RESEND_API_KEY: "unused",
    WEB_PUSH_VAPID_PUBLIC_KEY: "unused",
    WEB_PUSH_VAPID_PRIVATE_KEY: "unused",
    SHARD_NOTIFIER: {} as IdentityEnv["SHARD_NOTIFIER"],
    CHAT_ROOM: {} as IdentityEnv["CHAT_ROOM"],
    CHAT_INBOX: {} as IdentityEnv["CHAT_INBOX"],
    DB: proxy.env.DB,
    GUARDIAN: createGuardian(GUARDIAN_KEY),
    LAUNCH: { fetch: vi.fn(async () => Response.json({ chains: [] })) },
    VALUE_RELAY: { fetch: relay },
    DIRECTORY_RATE_LIMIT: { limit: async () => ({ success: true }) },
    PUBLIC_RATE_LIMIT: { limit: async () => ({ success: true }) },
    SIGN_IN_CODE_RATE_LIMIT: { limit: async ({ key }) => ({ success: countSignInCode(key) <= 3 }) },
    VERSION: { id: "test", tag: "", timestamp: "" },
  };
  auth = createIdentityAuth(env, {
    verifyWalletSignature: verifyAsWallet,
    sendWalletNotice: notices,
    sendSignInCode: async (email, code) => void sentCodes.set(email, code),
  });
}, 60_000);

afterAll(async () => {
  try {
    await proxy?.dispose();
  } finally {
    vi.unstubAllEnvs();
    rmSync(storageDirectory, { recursive: true, force: true });
  }
});

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
      {
        cache: proxy.caches.default as unknown as Cache,
        fetchShard,
        readLaunchDirectory: async () => launchDirectory,
      },
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
      user: {
        walletLinkedAt: number | null;
        email: string;
        id: string;
        name: string;
        realmsId: string;
        address?: string | null;
        suggestedName?: string | null;
      };
    } | null;
  return { request, session };
};

/** Proves a wallet to the identity service, to link it or to recover the account it is linked to. */
const proveWallet = async (
  browser: ReturnType<typeof createBrowser>,
  address: string,
  path: "link",
  chainId: IdentityChainId = environmentL2(env.ENVIRONMENT).chain,
) => {
  const { nonce, realmsId } = (await (await browser.request("/api/auth/siws/nonce", { body: { address } })).json()) as {
    nonce: string;
    realmsId: string;
  };
  const message = buildSiwsMessage({
    address,
    chainId,
    domain: new URL(ORIGIN).host,
    nonce,
    uri: ORIGIN,
    statement: payoutWalletStatement(realmsId),
  });
  const { r, s } = ec.starkCurve.sign(
    typedData.getMessageHash(message as unknown as TypedData, address),
    walletKeys.get(BigInt(address).toString(16))!,
  );
  return browser.request(`/api/auth/siws/${path}`, {
    body: {
      message: JSON.stringify(message),
      signature: [`0x${r.toString(16)}`, `0x${s.toString(16)}`],
      address,
      otp: await walletCode(browser),
    },
  });
};

/** A fresh code for a wallet change; each helper models a new code-send window. */
const walletCode = async (browser: ReturnType<typeof createBrowser>) => {
  const email = (await browser.session())!.user.email;
  codesRequested.delete(email);
  expect(
    (
      await browser.request("/api/auth/email-otp/send-verification-otp", {
        body: { email, type: "sign-in" },
      })
    ).status,
  ).toBe(200);
  return sentCodes.get(email)!;
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

/** Starts Discord sign-in in one browser and returns from Discord in another, as a phone's browser switch does. */
const returnInAnotherBrowser = async (
  starter: ReturnType<typeof createBrowser>,
  finisher: ReturnType<typeof createBrowser>,
  profile: { id: string; username: string; email: string; verified: boolean },
) => {
  const started = (await (
    await starter.request("/api/auth/sign-in/social", { body: { provider: "discord", callbackURL: "/" } })
  ).json()) as { url: string };
  const code = `code-${profile.id}`;
  discordProfiles.set(code, profile);
  const state = new URL(started.url).searchParams.get("state");
  return finisher.request(`/api/auth/callback/discord?code=${code}&state=${state}`);
};

/** The six digits the other browser's page shows. */
const handoffCodeOf = (page: string) => /class="code">(\d{6})</.exec(page)?.[1] ?? "";
const otherCode = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

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

  const now = () => Math.floor(Date.now() / 1000);
  const lastSeen = async (realmsId: string) =>
    visitRecord.seconds(
      ((await proxy.env.DB.prepare(visitRecord.lastVisit(realmsId)).first()) as { lastSeenAt?: unknown } | null)
        ?.lastSeenAt,
    );
  const setLastSeen = (realmsId: string, seconds: number) =>
    proxy.env.DB.prepare('UPDATE "user" SET "lastSeenAt" = ? WHERE "realmsId" = ?')
      .bind(seconds * 1000, realmsId)
      .run();

  it("keeps an account's last visit after it signs out, so a news email still sees that it came back", async () => {
    const DAY = 24 * 60 * 60;
    /** The sender's own read and rule: a founded Devcon player, no confirmed action, the record long begun. */
    const stillAway = async (realmsId: string) =>
      stillFits("D", { lastAction: 0, lastVisit: await lastSeen(realmsId) }, now(), 0);

    // A visit is the app reading its session; signing out deletes the session but not the visit.
    const researcher = createBrowser();
    expect((await signInWithCode(researcher, "researcher@realms.test")).status).toBe(200);
    const { realmsId } = (await researcher.session())!.user;
    expect(await lastSeen(realmsId)).toBeGreaterThanOrEqual(now() - 5);
    await setLastSeen(realmsId, now() - 3 * DAY);
    expect(await stillAway(realmsId)).toBe(true);
    await researcher.session();
    expect((await researcher.request("/api/auth/sign-out", { body: {} })).status).toBe(200);
    expect(await researcher.session()).toBeNull();
    const sessionsLeft = await proxy.env.DB.prepare(
      'SELECT count(*) AS n FROM "session" s JOIN "user" u ON u.id = s."userId" WHERE u."realmsId" = ?',
    )
      .bind(realmsId)
      .first<{ n: number }>();
    expect(sessionsLeft?.n).toBe(0);
    expect(await stillAway(realmsId)).toBe(false);

    // Written at most once an hour: a second load within the hour leaves the time as it was.
    const reader = createBrowser();
    expect((await signInWithCode(reader, "reader@realms.test")).status).toBe(200);
    const reading = (await reader.session())!.user.realmsId;
    const halfAnHourAgo = now() - 1800;
    await setLastSeen(reading, halfAnHourAgo);
    await reader.session();
    expect(await lastSeen(reading)).toBe(halfAnHourAgo);

    // Between two emails: the second player opens the game and signs out; the run reads D1 again and skips them.
    const away = [createBrowser(), createBrowser(), createBrowser()];
    const ids: string[] = [];
    for (const [index, browser] of away.entries()) {
      expect((await signInWithCode(browser, `away-${index}@realms.test`)).status).toBe(200);
      ids.push((await browser.session())!.user.realmsId);
      await setLastSeen(ids[index]!, now() - 3 * DAY);
    }
    const sent: string[] = [];
    const counts = await sendCampaign({
      deliveries: ids.map((id) => ({ realmsId: id, variant: "D" as const })),
      stillAway: async (delivery) => stillAway(delivery.realmsId),
      reserve: async () => "reserved",
      send: async (delivery) => {
        sent.push(delivery.realmsId);
        if (sent.length === 1) {
          await away[1]!.session();
          await away[1]!.request("/api/auth/sign-out", { body: {} });
        }
        return { kind: "accepted", id: null };
      },
      markSent: async () => {},
      release: async () => {},
      pause: async () => {},
    });
    expect(sent).toEqual([ids[0], ids[2]]);
    expect(counts).toMatchObject({ sent: 2, cameBack: 1 });
  });

  it("counts a player away from the visit record's first full hour, when it began less than a day before", async () => {
    const HOUR = 60 * 60;
    // Wrangler's own migrations table, as production has it: the sender reads from it when migration 0026 ran.
    await proxy.env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    ).run();
    const recordBegan = (secondsAgo: number) =>
      proxy.env.DB.prepare(
        "INSERT INTO d1_migrations (name, applied_at) VALUES ('0026_last_seen.sql', ?1) ON CONFLICT(name) DO UPDATE SET applied_at = ?1",
      )
        .bind(new Date((now() - secondsAgo) * 1000).toISOString().slice(0, 19).replace("T", " "))
        .run();
    /** The sender's own reads (when the record began, the account's last visit) and rule, at this moment. */
    const stillAway = async (realmsId: string, lastAction = 0) => {
      const { results } = await proxy.env.DB.prepare(visitRecord.began).all();
      return stillFits("D", { lastAction, lastVisit: await lastSeen(realmsId) }, now(), visitRecord.beganAt(results));
    };

    const player = createBrowser();
    expect((await signInWithCode(player, "early-away@realms.test")).status).toBe(200);
    const { realmsId } = (await player.session())!.user;
    // Last seen before the record began 11 hours ago (as the migration seeded it from an older session).
    await recordBegan(11 * HOUR);
    await setLastSeen(realmsId, now() - 12 * HOUR);
    expect(await stillAway(realmsId)).toBe(true);
    // Away counts from the record's first full hour (10 hours ago), not from 24 hours ago.
    expect(await stillAway(realmsId, now() - 20 * HOUR)).toBe(true);
    expect(await stillAway(realmsId, now() - 9 * HOUR)).toBe(false);
    // In the record's first hour a visit may be missing from it: nobody is away yet.
    await recordBegan(HOUR / 2);
    expect(await stillAway(realmsId)).toBe(false);
    // Opening the game brings the player back.
    await recordBegan(11 * HOUR);
    await player.session();
    expect(await stillAway(realmsId)).toBe(false);
  });

  it("creates an account on an email's first sign-in with a code, and signs the same account in after", async () => {
    const before = await userCount();
    const first = createBrowser();
    expect((await signInWithCode(first, "lord@realms.test")).status).toBe(200);
    expect(sentCodes.get("lord@realms.test")).toMatch(/^\d{6}$/);
    const created = await first.session();
    expect(created?.user.realmsId).toBe(realmsIdOf(created!.user.id));

    const second = createBrowser();
    expect((await signInWithCode(second, "LORD@realms.test")).status).toBe(200);
    expect((await second.session())?.user.id).toBe(created?.user.id);
    expect(await userCount()).toBe(before + 1);
  });

  it("stores a ten-minute code lifetime and returns its authoritative expiry", async () => {
    const browser = createBrowser();
    const requestedAt = Date.now();
    const response = await browser.request("/api/auth/email-otp/send-verification-otp", {
      body: { email: "expiry@realms.test", type: "sign-in" },
    });
    expect(response.status).toBe(200);
    const context = await auth.$context;
    const code = await context.internalAdapter.findVerificationValue("sign-in-otp-expiry@realms.test");
    expect(code).not.toBeNull();
    expect(code!.expiresAt.getTime()).toBeGreaterThanOrEqual(requestedAt + 600_000);
    expect(code!.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 600_000);
    expect(await response.json()).toEqual({ success: true, expires_at: code!.expiresAt.getTime() / 1000 });
    const refused = await browser.request("/api/auth/email-otp/send-verification-otp", {
      body: { email: "invalid", type: "sign-in" },
    });
    expect(refused.status).toBe(400);
    expect(await refused.json()).not.toHaveProperty("expires_at");
  });

  it.each([
    [9, 200],
    [11, 400],
  ])("accepts or expires an emailed code aged %i minutes", async (minutes, status) => {
    const browser = createBrowser();
    const email = `aged-${minutes}@realms.test`;
    expect(
      (
        await browser.request("/api/auth/email-otp/send-verification-otp", {
          body: { email, type: "sign-in" },
        })
      ).status,
    ).toBe(200);
    const context = await auth.$context;
    const identifier = `sign-in-otp-${email}`;
    const code = (await context.internalAdapter.findVerificationValue(identifier))!;
    await env.DB.prepare("UPDATE verification SET expiresAt = ? WHERE identifier = ?")
      .bind(new Date(code.expiresAt.getTime() - minutes * 60_000).toISOString(), identifier)
      .run();
    expect(
      (
        await browser.request("/api/auth/sign-in/email-otp", {
          body: { email, otp: sentCodes.get(email) },
        })
      ).status,
    ).toBe(status);
  });

  it("refuses a wrong or expired code", async () => {
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

    expect(await browser.session()).toBeNull();
  });

  it("refuses the fourth try after three wrong codes and lets the player request a fresh code", async () => {
    const browser = createBrowser();
    const email = "guess@realms.test";
    const ask = () =>
      browser.request("/api/auth/email-otp/send-verification-otp", { body: { email, type: "sign-in" } });
    const signIn = (otp: string) => browser.request("/api/auth/sign-in/email-otp", { body: { email, otp } });

    expect((await ask()).status).toBe(200);
    const code = sentCodes.get(email)!;
    expect(code).toMatch(/^\d{6}$/);
    const wrong = code === "000000" ? "111111" : "000000";
    for (let attempt = 0; attempt < 3; attempt += 1) expect((await signIn(wrong)).status).toBe(400);
    expect((await signIn(code)).status).toBe(403);
    expect(await browser.session()).toBeNull();

    expect((await ask()).status).toBe(200);
    expect((await signIn(sentCodes.get(email)!)).status).toBe(200);
    expect((await browser.session())?.user.email).toBe(email);
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

  it("cannot lock out sign-in or wallet recovery with malformed guesses naming a victim", async () => {
    const stranger = createBrowser();
    const email = "daily-budget@realms.test";
    for (let attempt = 0; attempt < 31; attempt++)
      await stranger.request("/api/auth/sign-in/email-otp", { body: { email, otp: "wrong" } });
    const player = createBrowser();
    expect((await signInWithCode(player, email)).status).toBe(200);
    expect((await player.request("/api/auth/siws/unlink", { body: { otp: await walletCode(player) } })).status).toBe(
      200,
    );
  }, 30_000);
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

  it("creates no account from a Discord email Discord has not verified, so that email's owner signs in to their own", async () => {
    const discord = fakeDiscord();
    try {
      const before = await userCount();
      const squatter = { id: "80351110224678999", username: "squat", email: "owner@realms.test", verified: false };
      const refused = await signInWithDiscord(createBrowser(), squatter);
      expect(refused.status).toBe(302);
      expect(refused.headers.get("location")).toContain("error=email_not_verified");
      expect(await userCount()).toBe(before);

      const owner = createBrowser();
      expect((await signInWithCode(owner, "owner@realms.test")).status).toBe(200);
      const account = (await owner.session())!.user;
      const discordRows = await proxy.env.DB.prepare(
        `SELECT count(*) AS n FROM "account" WHERE "userId" = ? AND "providerId" = 'discord'`,
      )
        .bind(account.id)
        .first<{ n: number }>();
      expect(discordRows?.n).toBe(0);
    } finally {
      discord.mockRestore();
    }
  });

  it("keeps a Discord sign-in finished in another browser for the browser that started it, behind a one-time code", async () => {
    const discord = fakeDiscord();
    try {
      const profile = { id: "80351110224670001", username: "maelis", email: "maelis@discord.test", verified: true };
      // An iPhone's home-screen app starts; Discord answers in Safari, which keeps its own cookies.
      const app = createBrowser();
      const safari = createBrowser();
      const shown = await returnInAnotherBrowser(app, safari, profile);
      expect(shown.status).toBe(200);
      expect(shown.headers.getSetCookie()).toEqual([]);
      const code = handoffCodeOf(await shown.text());
      expect(await safari.session()).toBeNull();

      const notStarted = await safari.request("/api/auth/discord-handoff", { body: { code } });
      expect(await notStarted.json()).toEqual({ code: "HANDOFF_NOT_STARTED" });
      const wrong = await app.request("/api/auth/discord-handoff", { body: { code: otherCode(code) } });
      expect(await wrong.json()).toEqual({ code: "INVALID_OTP" });
      expect(await app.session()).toBeNull();

      expect((await app.request("/api/auth/discord-handoff", { body: { code } })).status).toBe(200);
      expect((await app.session())?.user.email).toBe(profile.email);
      const spent = await app.request("/api/auth/discord-handoff", { body: { code } });
      expect(await spent.json()).toEqual({ code: "HANDOFF_NOT_STARTED" });
    } finally {
      discord.mockRestore();
    }
  });

  it("drops a Discord sign-in held for another browser after three wrong codes", async () => {
    const discord = fakeDiscord();
    try {
      const profile = { id: "80351110224670002", username: "orrin", email: "orrin@discord.test", verified: true };
      const app = createBrowser();
      const code = handoffCodeOf(await (await returnInAnotherBrowser(app, createBrowser(), profile)).text());
      const tries = [];
      for (let attempt = 0; attempt < 3; attempt += 1)
        tries.push(await (await app.request("/api/auth/discord-handoff", { body: { code: otherCode(code) } })).json());
      expect(tries).toEqual([{ code: "INVALID_OTP" }, { code: "INVALID_OTP" }, { code: "TOO_MANY_ATTEMPTS" }]);
      const late = await app.request("/api/auth/discord-handoff", { body: { code } });
      expect(await late.json()).toEqual({ code: "OTP_EXPIRED" });
      expect(await app.session()).toBeNull();
    } finally {
      discord.mockRestore();
    }
  });

  it("lets only one of several concurrent right codes take a held Discord sign-in", async () => {
    const discord = fakeDiscord();
    try {
      const app = createBrowser();
      const profile = { id: "80351110224670003", username: "race", email: "race@discord.test", verified: true };
      const code = handoffCodeOf(await (await returnInAnotherBrowser(app, createBrowser(), profile)).text());
      const claims = await Promise.all(
        Array.from({ length: 4 }, () => app.request("/api/auth/discord-handoff", { body: { code } })),
      );
      const taken = claims.filter((claim) => claim.status === 200);
      expect(taken).toHaveLength(1);
      expect(taken[0]!.headers.getSetCookie().some((cookie) => /session_token=[^;]/.test(cookie))).toBe(true);
      for (const refused of claims.filter((claim) => claim.status !== 200))
        expect(refused.headers.getSetCookie().some((cookie) => /session_token=[^;]/.test(cookie))).toBe(false);
      expect((await app.session())?.user.email).toBe(profile.email);
    } finally {
      discord.mockRestore();
    }
  });

  it("counts every one of three concurrent wrong codes, so the right one after them is refused", async () => {
    const discord = fakeDiscord();
    try {
      const app = createBrowser();
      const profile = { id: "80351110224670004", username: "guess", email: "guess@discord.test", verified: true };
      const code = handoffCodeOf(await (await returnInAnotherBrowser(app, createBrowser(), profile)).text());
      const wrong = await Promise.all(
        Array.from({ length: 3 }, () => app.request("/api/auth/discord-handoff", { body: { code: otherCode(code) } })),
      );
      expect(
        (await Promise.all(wrong.map(async (reply) => ((await reply.json()) as { code: string }).code))).sort(),
      ).toEqual(["INVALID_OTP", "INVALID_OTP", "TOO_MANY_ATTEMPTS"]);
      expect((await app.request("/api/auth/discord-handoff", { body: { code } })).status).toBe(400);
      expect(await app.session()).toBeNull();
    } finally {
      discord.mockRestore();
    }
  });

  it("takes a held Discord sign-in at most once when right and wrong codes race, and never brings it back", async () => {
    const discord = fakeDiscord();
    try {
      const app = createBrowser();
      const profile = { id: "80351110224670005", username: "mixed", email: "mixed@discord.test", verified: true };
      const code = handoffCodeOf(await (await returnInAnotherBrowser(app, createBrowser(), profile)).text());
      const claims = await Promise.all(
        [code, otherCode(code), code, otherCode(code), otherCode(code), otherCode(code)].map((each) =>
          app.request("/api/auth/discord-handoff", { body: { code: each } }),
        ),
      );
      expect(claims.filter((claim) => claim.status === 200).length).toBeLessThanOrEqual(1);
      // Taken, or out of tries: either way no live hold is left to take, and a late try does not make one.
      await app.request("/api/auth/discord-handoff", { body: { code: otherCode(code) } });
      const live = await proxy.env.DB.prepare(
        "SELECT count(*) AS n FROM discord_handoffs WHERE code_hash = ?1 AND attempts < 3",
      )
        .bind(createHash("sha256").update(code).digest("hex"))
        .first<{ n: number }>();
      expect(live?.n).toBe(0);
      expect((await app.request("/api/auth/discord-handoff", { body: { code } })).status).toBe(400);
    } finally {
      discord.mockRestore();
    }
  });

  it("spends a wrong code's try without moving the hold's expiry", async () => {
    const discord = fakeDiscord();
    try {
      const app = createBrowser();
      const profile = { id: "80351110224670006", username: "clock", email: "clock@discord.test", verified: true };
      const code = handoffCodeOf(await (await returnInAnotherBrowser(app, createBrowser(), profile)).text());
      const hold = () =>
        proxy.env.DB.prepare("SELECT attempts, expires_at FROM discord_handoffs WHERE code_hash = ?1")
          .bind(createHash("sha256").update(code).digest("hex"))
          .first<{ attempts: number; expires_at: number }>();
      const before = await hold();
      await app.request("/api/auth/discord-handoff", { body: { code: otherCode(code) } });
      expect(await hold()).toEqual({ attempts: 1, expires_at: before!.expires_at });
    } finally {
      discord.mockRestore();
    }
  });

  it("sends a Discord refusal finished in another browser back to the flow there, holding nothing", async () => {
    const app = createBrowser();
    const started = (await (
      await app.request("/api/auth/sign-in/social", {
        body: { provider: "discord", callbackURL: "/season", errorCallbackURL: "/season" },
      })
    ).json()) as { url: string };
    const state = new URL(started.url).searchParams.get("state");
    const refused = await createBrowser().request(`/api/auth/callback/discord?error=access_denied&state=${state}`);
    expect(refused.status).toBe(302);
    expect(refused.headers.get("location")).toBe("/season?error=access_denied");
    const claim = await app.request("/api/auth/discord-handoff", { body: { code: "000000" } });
    expect(await claim.json()).toEqual({ code: "OTP_EXPIRED" });
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

  it("signs player and bot changes only for listed pending, active or draining chains", async () => {
    const browser = createBrowser();
    await signInWithCode(browser, "chain-allow-list@realms.test");
    const player = deviceChangeFor((await browser.session())!.user.realmsId);
    const bot = {
      ...player,
      label: "0xb07",
      account: realmsAccountAddress(botRealmsId("0xb07"), ACCOUNT_CLASS_HASH, await env.GUARDIAN.publicKey()),
    };
    await env.DB.prepare(`INSERT INTO shards (url, chainId, status, addedAt) VALUES (?, ?, 'active', ?)`)
      .bind("https://devices.realms.test", CHAIN_ID, Date.now())
      .run();
    const signing = vi.spyOn(env.GUARDIAN, "signDeviceChange");
    try {
      for (const status of ["pending", "active", "draining", "retired"]) {
        await env.DB.prepare("UPDATE shards SET status = ? WHERE chainId = ?").bind(status, CHAIN_ID).run();
        for (const [path, change] of [
          ["/api/devices", player],
          ["/api/devices/bots", bot],
        ] as const) {
          signing.mockClear();
          const response = await browser.request(path, {
            body: { ...change, chainId: `0x0${CHAIN_ID.slice(2)}` },
            token: OPERATOR_TOKEN,
          });
          const approved = status !== "retired" && (status !== "pending" || path === "/api/devices/bots");
          expect(response.status).toBe(approved ? 200 : 403);
          expect(signing).toHaveBeenCalledTimes(approved ? 1 : 0);
        }
      }
      for (const chainId of ["0x123", "0x534e5f4d41494e", "0x534e5f5345504f4c4941"]) {
        for (const [path, change] of [
          ["/api/devices", player],
          ["/api/devices/bots", bot],
        ] as const) {
          signing.mockClear();
          const response = await browser.request(path, { body: { ...change, chainId }, token: OPERATOR_TOKEN });
          expect(response.status).toBe(403);
          expect(await response.json()).toEqual({ error: "chain_not_approved" });
          expect(signing).not.toHaveBeenCalled();
        }
      }
    } finally {
      signing.mockRestore();
      await env.DB.prepare("UPDATE shards SET status = 'active' WHERE chainId = ?").bind(CHAIN_ID).run();
    }
  });

  it("enrolls pending shards without exposing them until the deployment activates them", async () => {
    const operator = createBrowser();
    const url = "https://pending-shard.test";
    const chainId = "0x123abc";
    heralds.set(`${url}/manifest`, shardManifest(chainId));
    heralds.set(`${url}/games`, { chain: chainId, games: [] });
    const admit = (path: string) => operator.request(path, { body: { url }, token: OPERATOR_TOKEN });
    expect((await admit("/api/directory/shards")).status).toBe(409);
    expect((await operator.request("/api/directory/shards/pending", { body: { url } })).status).toBe(401);
    expect((await admit("/api/directory/shards/pending")).status).toBe(201);
    const visible = async (path: string) => JSON.stringify(await (await operator.request(path)).json());
    expect(await visible("/api/directory")).not.toContain(url);
    expect(await visible("/api/directory/history")).not.toContain(url);
    expect((await operator.request("/api/directory/shards")).status).toBe(401);
    const recorded = await operator.request("/api/directory/shards", { token: OPERATOR_TOKEN });
    expect(recorded.status).toBe(200);
    expect(((await recorded.json()) as { shards: unknown[] }).shards).toContainEqual(
      expect.objectContaining({ url, chainId, status: "pending" }),
    );
    const bot = {
      label: "0xbeef",
      chainId,
      account: realmsAccountAddress(botRealmsId("0xbeef"), ACCOUNT_CLASS_HASH, await env.GUARDIAN.publicKey()),
      action: "ADD",
      deviceKey: "0x123",
      counter: 1,
    };
    expect((await operator.request("/api/devices/bots", { body: bot, token: OPERATOR_TOKEN })).status).toBe(200);
    expect(
      (
        await operator.request("/api/directory/shards/status", {
          body: { url, status: "active" },
          token: OPERATOR_TOKEN,
        })
      ).status,
    ).not.toBe(200);
    expect((await admit("/api/directory/shards")).status).toBe(201);
    expect(await visible("/api/directory")).toContain(url);
    expect((await admit("/api/directory/shards")).status).toBe(200);
    await env.DB.prepare("DELETE FROM shards WHERE url = ?").bind(url).run();
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

  it("keeps an account's build orders by revision, refuses one the game cannot read, and shows them to their owner only", async () => {
    const browser = createBrowser();
    await signInWithCode(browser, "build-orders@realms.test");
    const owner = (await browser.session())!.user.realmsId;
    const coalRush = {
      name: "Coal rush",
      steps: [
        { rank: "City", goal: "coal", count: 2 },
        { rank: "City", goal: "levelUp" },
      ],
    };
    const book = (order: unknown) => ({ orders: [{ id: "o1", order }], active: "o1" });
    const save = (revision: number, order: unknown) =>
      browser.request("/api/build-orders", { body: { owner, revision, book: book(order) } });

    expect(await (await browser.request("/api/build-orders")).json()).toEqual({
      owner,
      revision: 0,
      book: { orders: [], active: null },
    });
    expect(await (await save(0, coalRush)).json()).toEqual({ owner, revision: 1, book: book(coalRush) });
    expect((await save(0, coalRush)).status).toBe(409);
    const unreadable = await save(1, { ...coalRush, steps: [{ rank: "City", goal: "mill", count: 2 }] });
    expect([unreadable.status, await unreadable.json()]).toEqual([
      400,
      {
        error: "invalid_build_orders",
        message:
          "Step 1: “mill” is not a goal: farm, wood, coal, copper, ironwood, coldIron, gold, adamantine, mithral, dragonhide, market, knightT1, knightT2, knightT3, crossbowmanT1, crossbowmanT2, crossbowmanT3, paladinT1, paladinT2, paladinT3, hut, barracks, barracksT2, barracksT3, army, armyT2, armyT3, levelUp.",
      },
    ]);
    expect(((await (await browser.request("/api/build-orders")).json()) as { revision: number }).revision).toBe(1);
    // An order of T2 and T3 steps is kept as made.
    const ironRush = {
      name: "Iron rush",
      steps: [
        { rank: "City", goal: "ironwood", count: 1 },
        { rank: "Kingdom", goal: "knightT2", count: 1 },
        { rank: "Kingdom", goal: "armyT3", count: 1 },
      ],
    };
    expect(await (await save(1, ironRush)).json()).toEqual({ owner, revision: 2, book: book(ironRush) });
    expect((await createBrowser().request("/api/build-orders")).status).toBe(401);
  });

  /** A running Devcon season game in a shard's directory, as Herald answers it for one player. */
  const devconGame = (entered: boolean) => ({
    game_id: 41,
    name: "devcon",
    mode: "frontier",
    preset_id: 6,
    status: "Live",
    player_state: {
      registered: entered,
      settled: entered,
      roster_wallet: null,
      held_realm_id: null,
      has_home_source: false,
      taken_realm_ids: [],
      structures: [],
    },
  });
  /**
   * What every listed shard tells the redeem about this account: no running Devcon game entered, except on the shards
   * named in `devcon`, whose Devcon game this account entered or not.
   */
  const heraldsAnswerFor = async (realmsId: string, devcon: Record<string, boolean> = {}) => {
    const account = realmsAccountAddress(realmsId, ACCOUNT_CLASS_HASH, await env.GUARDIAN.publicKey());
    const { results } = await env.DB.prepare(
      `SELECT url, chainId FROM shards WHERE status IN ('active', 'draining')`,
    ).all<{ url: string; chainId: string }>();
    for (const { url, chainId } of results) {
      const games = url in devcon ? [devconGame(devcon[url]!)] : [];
      heralds.set(`${url}/games?player=${account}`, { chain: chainId, games });
      if (url in devcon)
        heralds.set(`${url}/games/41/snapshot?models=EntryEntitlement%2CStructure%2CCampaignHome%2CSettledRealm`, {
          game_id: "41",
          confirmed_block: 1,
          models: [
            {
              model: "EntryEntitlement",
              rows: devcon[url]
                ? [
                    {
                      key: `41:${account}`,
                      value: {
                        game_id: 41,
                        owner: account,
                        realm_id: "711",
                        metadata_1: "0",
                        metadata_2: "0",
                        metadata_3: "0",
                        pass_kind: 2,
                      },
                    },
                  ]
                : [],
            },
            { model: "Structure", rows: [] },
            { model: "CampaignHome", rows: [] },
            { model: "SettledRealm", rows: [] },
          ],
        });
    }
  };

  describe("flyer redemption", () => {
    const printed = async (code: string, tier: "regular" | "golden") =>
      env.DB.prepare('INSERT INTO "campaign_codes" ("campaign", "code_hash", "tier") VALUES (?, ?, ?)')
        .bind("devcon-2026", await campaignCodeHash("devcon-2026", code), tier)
        .run();
    const player = async (name: string) => {
      const browser = createBrowser();
      await signInWithCode(browser, `${name}@realms.test`);
      const realmsId = (await browser.session())!.user.realmsId;
      await heraldsAnswerFor(realmsId);
      const redeem = async (code?: string, campaign = "devcon-2026") => {
        const response = await browser.request("/api/campaigns/redeem", { body: { campaign, code } });
        return [response.status, await response.json()];
      };
      return { redeem, realmsId };
    };
    const ticket = (tier: string) => [200, { campaign: "devcon-2026", tier }];
    const taken = [410, { error: "ticket_taken" }];
    /** The tiers of the printed codes no account holds yet, which a shared code draws from. */
    const unspentTiers = async () =>
      (
        await env.DB.prepare(
          `SELECT "tier" FROM "campaign_codes" AS code WHERE "campaign" = 'devcon-2026'
           AND NOT EXISTS (SELECT 1 FROM "campaign_tickets" AS ticket WHERE ticket."code_hash" = code."code_hash")`,
        ).all<{ tier: string }>()
      ).results.map(({ tier }) => tier);
    type Player = Awaited<ReturnType<typeof player>>;
    let first: Player, second: Player, regular: Player, other: Player, late: Player;
    let goldenRacers: [Player, Player], regularRacers: [Player, Player];

    beforeAll(async () => {
      [first, second, regular, other, late] = await Promise.all([
        player("golden-first"),
        player("golden-second"),
        player("regular-flyer"),
        player("other-campaign"),
        player("after-devcon"),
      ]);
      [goldenRacers, regularRacers] = await Promise.all([
        Promise.all([player("race-a-golden"), player("race-b-golden")]),
        Promise.all([player("race-a-regular"), player("race-b-regular")]),
      ]);
    });

    it("gives each flyer's ticket to its first account only and keeps retries from spending another code", async () => {
      await printed("T9HW3NPB", "golden");
      await printed("K7M2QX4R", "regular");
      expect(await first.redeem("t9hw3npb")).toEqual(ticket("golden"));
      expect(await first.redeem("T9HW3NPB")).toEqual(ticket("golden"));
      expect(await first.redeem("K7M2QX4R")).toEqual(ticket("golden"));
      expect(await first.redeem()).toEqual(ticket("golden"));
      expect(await second.redeem("T9HW3NPB")).toEqual(taken);
      expect(await regular.redeem("K7M2QX4R")).toEqual(ticket("regular"));
      expect(await second.redeem("K7M2QX4R")).toEqual(taken);
      expect(await campaignTicketFor(env.DB, first.realmsId, 6)).toEqual({ campaign: "devcon-2026", tier: "golden" });
      expect(await campaignTicketFor(env.DB, regular.realmsId, 6)).toEqual({
        campaign: "devcon-2026",
        tier: "regular",
      });
      expect(await campaignTicketFor(env.DB, second.realmsId, 6)).toBeNull();
      expect(await campaignTicketFor(env.DB, first.realmsId, 5)).toBeNull();
    });

    it("refuses bare links, unknown codes, other campaigns and signed-out redemption", async () => {
      expect(await other.redeem()).toEqual([400, { error: "invalid_redemption" }]);
      expect(await other.redeem("ZZZZZZZZ")).toEqual(taken);
      expect(await other.redeem("T9HW3NPB", "devcon-2025")).toEqual([400, { error: "invalid_redemption" }]);
      const signedOut = await createBrowser().request("/api/campaigns/redeem", {
        body: { campaign: "devcon-2026", code: "K7M2QX4R" },
      });
      expect(signedOut.status).toBe(401);
    });

    it.each(["golden", "regular"] as const)("gives a raced %s flyer to exactly one account", async (tier) => {
      const code = tier === "golden" ? "GQ2MZ7XA" : "R8VNC4TW";
      await printed(code, tier);
      const racers = tier === "golden" ? goldenRacers : regularRacers;
      const raced = await Promise.all(racers.map((racer) => racer.redeem(code)));
      expect(raced.map(([status]) => status).sort()).toEqual([200, 410]);
      expect(raced.find(([status]) => status === 200)).toEqual(ticket(tier));
    });

    it("draws each account bringing a shared code one unspent printed ticket, at its tier, until none is left", async () => {
      const shared = "SH4R3DQX";
      // The operator's script writes the shared code's SQL from its environment; loading it twice changes nothing.
      const out = join(mkdtempSync(join(tmpdir(), "campaign-shared-")), "shared.sql");
      execFileSync("pnpm", ["campaign-shared-code", "devcon-2026", out], {
        cwd: new URL("..", import.meta.url),
        env: { ...process.env, CAMPAIGN_SHARED_CODE: shared.toLowerCase() },
      });
      const sql = readFileSync(out, "utf8");
      expect(sql).not.toContain(shared);
      await env.DB.batch([sql, sql].map((statement) => env.DB.prepare(statement)));
      rmSync(dirname(out), { recursive: true, force: true });
      await Promise.all([
        printed("D2AWG8LD", "golden"),
        printed("P5YKE3MV", "regular"),
        printed("U7CJ9TFB", "regular"),
      ]);
      const pool = await unspentTiers();
      expect(pool.length).toBeGreaterThanOrEqual(3);
      const drawers = await Promise.all(pool.map((_, index) => player(`shared-${index}`)));
      // Every account draws at once: each gets a different printed code, so the drawn tiers are exactly the pool's.
      const drawn = await Promise.all(drawers.map((drawer) => drawer.redeem(shared)));
      expect(drawn.map(([status]) => status)).toEqual(pool.map(() => 200));
      expect(drawn.map(([, body]) => (body as { tier: string }).tier).sort()).toEqual([...pool].sort());
      expect(await unspentTiers()).toEqual([]);
      // A retry, with the shared code or none, answers the ticket drawn.
      expect(await drawers[0]!.redeem(shared)).toEqual(drawn[0]);
      expect(await drawers[0]!.redeem()).toEqual(drawn[0]);
      expect(await campaignTicketFor(env.DB, drawers[0]!.realmsId, 6)).toEqual(drawn[0]![1]);
      // Once every printed ticket is drawn, the shared code gives a regular ticket, from no printed code.
      const late = await player("shared-late");
      expect(await late.redeem(shared)).toEqual(ticket("regular"));
      expect(await campaignTicketFor(env.DB, late.realmsId, 6)).toEqual({ campaign: "devcon-2026", tier: "regular" });
      expect(await unspentTiers()).toEqual([]);
    });

    it("refuses a new ticket after the season but still answers a held ticket", async () => {
      await printed("M3XKP7HQ", "regular");
      await printed("Z9X2M4NH", "golden");
      expect(await late.redeem("Z9X2M4NH")).toEqual(ticket("golden"));
      const now = vi.spyOn(Date, "now").mockReturnValue(CAMPAIGNS["devcon-2026"].redeemUntil * 1000);
      try {
        expect(await other.redeem("M3XKP7HQ")).toEqual([410, { error: "campaign_closed" }]);
        expect(await late.redeem("Z9X2M4NH")).toEqual(ticket("golden"));
      } finally {
        now.mockRestore();
      }
    });
  });

  it("recovers a founded free home through the operator draw, preserving the ticket on retry", async () => {
    const shard = "https://recovery-season.test";
    onTestFinished(async () => {
      await env.DB.prepare("DELETE FROM shards WHERE url = ?").bind(shard).run();
    });
    await env.DB.prepare(`INSERT INTO shards (url, chainId, status, addedAt) VALUES (?, '0xdd', 'active', ?)`)
      .bind(shard, Date.now())
      .run();
    await env.DB.prepare('INSERT INTO "campaign_codes" ("campaign", "code_hash", "tier") VALUES (?, ?, ?)')
      .bind("devcon-2026", await campaignCodeHash("devcon-2026", "H9MP3QWA"), "regular")
      .run();
    const browser = createBrowser();
    await signInWithCode(browser, "recovered-home@realms.test");
    const realmsId = (await browser.session())!.user.realmsId;
    await heraldsAnswerFor(realmsId, { [shard]: false });
    const account = realmsAccountAddress(realmsId, ACCOUNT_CLASS_HASH, await env.GUARDIAN.publicKey());
    heralds.set(`${shard}/games?player=${account}`, { chain: "0xdd", games: [devconGame(true)] });
    const operator = createBrowser();
    const path = "/api/operator/campaign-draw";
    const body = { campaign: "devcon-2026", realmsId };
    const send = (token?: string, extra = {}) =>
      operator.request(path, { body: { ...body, ...extra }, ...(token ? { token } : {}) });
    expect((await send()).status).toBe(401);
    expect((await send(OPERATOR_TOKEN, { tier: "golden" })).status).toBe(400);
    const first = await send(OPERATOR_TOKEN);
    const ticket = await first.json();
    expect(first.status).toBe(200);
    expect(ticket).toEqual({ campaign: "devcon-2026", tier: expect.stringMatching(/^(regular|golden)$/) });
    expect(await (await send(OPERATOR_TOKEN)).json()).toEqual(ticket);
    expect(await campaignTicketFor(env.DB, realmsId, 6)).toEqual(ticket);
  });

  it("prints flyers whose codes, once loaded, give exactly the print run's golden count of golden tickets", async () => {
    const out = mkdtempSync(join(tmpdir(), "campaign-codes-"));
    const generate = () =>
      execFileSync("pnpm", ["campaign-codes", "devcon-2026", "24", "https://play.dev-realms.party", out], {
        cwd: new URL("..", import.meta.url),
        env: { ...process.env, CAMPAIGN_CODE_SEED: "campaign-test-seed-campaign-test-seed" },
      });
    generate();
    const sql = readFileSync(join(out, "codes.sql"), "utf8");
    const pages = readFileSync(join(out, "print.csv"), "utf8").trim().split("\n").slice(1);
    generate();
    // The same seed makes the same print file and the same codes again, and loading them twice changes nothing.
    expect([readFileSync(join(out, "codes.sql"), "utf8"), readdirSync(join(out, "qr")).length]).toEqual([sql, 25]);
    // The posters' QR is the game's own address: it grants nothing.
    expect(readFileSync(join(out, "qr", "game.svg"), "utf8")).toContain("<svg");
    const statements = (sql + sql)
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);
    await env.DB.batch(statements.map((statement) => env.DB.prepare(statement)));

    const tiers: string[] = [];
    for (const [index, page] of pages.entries()) {
      const [, qr, url] = page.split(",");
      expect([qr, url]).toEqual([
        `qr/${String(index + 1).padStart(4, "0")}.svg`,
        expect.stringMatching(/^https:\/\/play\.dev-realms\.party\/join\/devcon\/[A-HJ-NP-Z2-9]{8}$/),
      ]);
      const browser = createBrowser();
      await signInWithCode(browser, `flyer-${index}@realms.test`);
      await heraldsAnswerFor((await browser.session())!.user.realmsId);
      const code = url!.slice(url!.lastIndexOf("/") + 1);
      // The database gets hashes only.
      expect(sql).not.toContain(code);
      const response = await browser.request("/api/campaigns/redeem", { body: { campaign: "devcon-2026", code } });
      tiers.push(((await response.json()) as { tier: string }).tier);
    }
    // The generator prints exactly the print run's golden count.
    expect(tiers.filter((tier) => tier === "golden")).toHaveLength(CAMPAIGNS["devcon-2026"].printedGolden);
    expect(tiers.filter((tier) => tier === "regular")).toHaveLength(24 - CAMPAIGNS["devcon-2026"].printedGolden);
    // Our private list names exactly the pages that opened golden.
    const goldenPages = pages
      .filter((_, index) => tiers[index] === "golden")
      .map((page) => page.replace(/,qr\/\d+\.svg,/, ","));
    expect(readFileSync(join(out, "golden.csv"), "utf8")).toBe(`page,url\n${goldenPages.join("\n")}\n`);
    // A flyer passed on after use opens nothing for the next account.
    const next = createBrowser();
    await signInWithCode(next, "flyer-passed-on@realms.test");
    await heraldsAnswerFor((await next.session())!.user.realmsId);
    const firstCode = pages[0]!.slice(pages[0]!.lastIndexOf("/") + 1);
    const again = await next.request("/api/campaigns/redeem", { body: { campaign: "devcon-2026", code: firstCode } });
    expect([again.status, await again.json()]).toEqual([410, { error: "ticket_taken" }]);
    rmSync(out, { recursive: true, force: true });
  }, 60_000);

  it("keeps a flyer unspent for a home with a source, or while a shard cannot say", async () => {
    const shard = "https://devcon-season.test";
    await env.DB.prepare(`INSERT INTO shards (url, chainId, status, addedAt) VALUES (?, '0xdc', 'active', ?)`)
      .bind(shard, Date.now())
      .run();
    await env.DB.prepare('INSERT INTO "campaign_codes" ("campaign", "code_hash", "tier") VALUES (?, ?, ?)')
      .bind("devcon-2026", await campaignCodeHash("devcon-2026", "F7QZ2KHM"), "golden")
      .run();
    const player = async (name: string, entered: boolean) => {
      const browser = createBrowser();
      await signInWithCode(browser, `${name}@realms.test`);
      const realmsId = (await browser.session())!.user.realmsId;
      await heraldsAnswerFor(realmsId, { [shard]: entered });
      return async (code?: string) => {
        const response = await browser.request("/api/campaigns/redeem", { body: { campaign: "devcon-2026", code } });
        return [response.status, await response.json()];
      };
    };

    // Founded with a held Realm: refused, and the flyer is not spent.
    const founded = await player("founded-first", true);
    expect(await founded("F7QZ2KHM")).toEqual([409, { error: "realm_founded" }]);
    expect(await founded("F7QZ2KHM")).toEqual([409, { error: "realm_founded" }]);
    // A shared code draws nothing for it either.
    await env.DB.prepare('INSERT INTO "campaign_shared_codes" ("campaign", "code_hash") VALUES (?, ?)')
      .bind("devcon-2026", await campaignCodeHash("devcon-2026", "SH4R3DW7"))
      .run();
    expect(await founded("SH4R3DW7")).toEqual([409, { error: "realm_founded" }]);
    // The friend it is passed to, not yet in the game, opens it at its tier.
    const friend = await player("flyer-friend", false);
    for (const [url, body] of heralds) {
      if (
        url.startsWith(`${shard}/games?`) &&
        (body as { games?: { player_state?: { settled: boolean } }[] }).games?.[0]?.player_state?.settled === false
      )
        heralds.set(url, { chain: "0xdc", games: [devconGame(true)] });
    }
    expect(await friend("F7QZ2KHM")).toEqual([200, { campaign: "devcon-2026", tier: "golden" }]);
    expect(await founded("F7QZ2KHM")).toEqual([410, { error: "ticket_taken" }]);

    // A shard that cannot answer, answers for another chain, or stalls past the shard timeout leaves the flyer
    // unspent: the account is told to try again, and the same code opens once the shard answers for its own chain.
    await env.DB.prepare('INSERT INTO "campaign_codes" ("campaign", "code_hash", "tier") VALUES (?, ?, ?)')
      .bind("devcon-2026", await campaignCodeHash("devcon-2026", "B4NW8RXC"), "regular")
      .run();
    const unsure = createBrowser();
    await signInWithCode(unsure, "shard-unsure@realms.test");
    const unsureId = (await unsure.session())!.user.realmsId;
    const account = realmsAccountAddress(unsureId, ACCOUNT_CLASS_HASH, await env.GUARDIAN.publicKey());
    const redeem = async () => {
      const response = await unsure.request("/api/campaigns/redeem", {
        body: { campaign: "devcon-2026", code: "B4NW8RXC" },
      });
      return [response.status, await response.json()];
    };
    const retry = [503, { error: "campaigns_unavailable" }];
    await heraldsAnswerFor(unsureId, { [shard]: false });
    heralds.delete(`${shard}/games?player=${account}`);
    expect(await redeem()).toEqual(retry);
    heralds.set(`${shard}/games?player=${account}`, { chain: "0xdead", games: [devconGame(false)] });
    expect(await redeem()).toEqual(retry);
    heralds.set(`${shard}/games?player=${account}`, STALLED);
    const stalledAt = Date.now();
    expect(await redeem()).toEqual(retry);
    expect(Date.now() - stalledAt).toBeLessThan(15_000);
    await heraldsAnswerFor(unsureId, { [shard]: false });
    expect(await redeem()).toEqual([200, { campaign: "devcon-2026", tier: "regular" }]);
    await env.DB.prepare("UPDATE shards SET status = 'retired' WHERE url = ?").bind(shard).run();
  }, 30_000);

  describe("referrals", () => {
    const shard = "https://referral-season.test";
    const campaign = "devcon-2026";
    /** Homes founded in the referral shard's Devcon game, by account: their source and the season board's view of them. */
    const founded = new Map<string, { source: "free" | "realm" | "campaign"; sites: number; tier: number | null }>();
    let boardAnswers = true;
    /** The next tiers referral links draw, oldest first; regular once none is queued. */
    const draws: ("regular" | "golden")[] = [];
    const getRandomValues = crypto.getRandomValues.bind(crypto);

    beforeAll(async () => {
      await env.DB.prepare(`INSERT INTO shards (url, chainId, status, addedAt) VALUES (?, '0xd5', 'active', ?)`)
        .bind(shard, Date.now())
        .run();
      // A link's draw reads one 32-bit value; everything else keeps its own randomness.
      vi.spyOn(crypto, "getRandomValues").mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
        if (array instanceof Uint32Array && array.length === 1) {
          array[0] = draws.shift() === "golden" ? 0 : 0xffffffff;
          return array;
        }
        return getRandomValues(array as never) as T;
      });
    });
    afterAll(async () => {
      vi.mocked(crypto.getRandomValues).mockRestore();
      await env.DB.prepare("UPDATE shards SET status = 'retired' WHERE url = ?").bind(shard).run();
    });

    /** What the shards' Heralds answer now: the Devcon game's home facts and season board, from `founded`. */
    const publishHeralds = async () => {
      const { results } = await env.DB.prepare(
        `SELECT url, chainId FROM shards WHERE status IN ('active', 'draining')`,
      ).all<{ url: string; chainId: string }>();
      for (const { url, chainId } of results)
        heralds.set(`${url}/games`, { chain: chainId, games: url === shard ? [devconGame(true)] : [] });
      const entitled = [...founded].filter(([, home]) => home.source !== "free");
      heralds.set(`${shard}/games/41/snapshot?models=EntryEntitlement%2CStructure%2CCampaignHome%2CSettledRealm`, {
        game_id: "41",
        confirmed_block: 1,
        models: [
          {
            model: "EntryEntitlement",
            rows: entitled.map(([account, home]) => ({
              key: `41:${account}`,
              value: {
                game_id: 41,
                owner: account,
                realm_id: home.source === "realm" ? "711" : "0",
                metadata_1: "0",
                metadata_2: "0",
                metadata_3: "0",
                pass_kind: home.source === "realm" ? 2 : 3,
              },
            })),
          },
          { model: "Structure", rows: [] },
          { model: "CampaignHome", rows: [] },
          { model: "SettledRealm", rows: [] },
        ],
      });
      const board = `${shard}/games/41/leaderboard`;
      if (!boardAnswers) return void heralds.delete(board);
      heralds.set(board, {
        game_id: "41",
        mode: "frontier",
        prize: null,
        entries: [...founded].map(([address, home], index) => ({
          address,
          structure_id: String(index + 1),
          campaign: home.tier === null ? null : { campaign_id: "0x646576636f6e2d32303236", tier: home.tier },
          rank: index + 1,
          sites_cleared: { total: home.sites, camps: home.sites, rifts: 0, ruins: 0, beasts: 0 },
          chests_earned: 0,
          rewards: { lords: "0", essence: "0", labor: "0" },
          deepest_depth: 0,
          level: 0,
          order: 1,
        })),
      });
    };

    let devices = 0;
    /**
     * A signed-in player. By default each signs in with their own mailbox and on their own device, approved by the
     * guardian through /api/devices as the client asks; `email` and `device` make one share another's, and
     * `device: null` approves none yet.
     */
    const player = async (name: string, { email, device }: { email?: string; device?: string | null } = {}) => {
      const browser = createBrowser();
      await signInWithCode(browser, email ?? `${name}@realms.test`);
      const realmsId = (await browser.session())!.user.realmsId;
      await heraldsAnswerFor(realmsId, { [shard]: false });
      const account = accountKey(realmsAccountAddress(realmsId, ACCOUNT_CLASS_HASH, await env.GUARDIAN.publicKey()));
      let counter = 0;
      const onDevice = async (deviceKey: string) => {
        const change = { ...deviceChangeFor(realmsId, { counter: ++counter }), chainId: "0xd5", deviceKey };
        expect((await browser.request("/api/devices", { body: change })).status).toBe(200);
      };
      const own = device === undefined ? `0x${(0xd0000 + ++devices).toString(16)}` : device;
      if (own !== null) await onDevice(own);
      const call = async (path: string, body?: unknown) => {
        await publishHeralds();
        const response = await browser.request(path, body === undefined ? {} : { body });
        return [response.status, await response.json()] as [number, any];
      };
      return {
        browser,
        realmsId,
        device: own,
        onDevice,
        /** Signs out, as the client does: the session and its device rows go. */
        signOut: async () => expect((await browser.request("/api/auth/sign-out", { body: {} })).status).toBe(200),
        signIn: () => signInWithCode(browser, email ?? `${name}@realms.test`),
        redeem: (body: Record<string, unknown> = {}) => call("/api/campaigns/redeem", { campaign, ...body }),
        referral: () => call(`/api/campaigns/referral?campaign=${campaign}`),
        code: async () => (await call(`/api/campaigns/referral?campaign=${campaign}`))[1].code as string,
        found: (source: "free" | "realm" | "campaign", sites = 0, tier: number | null = null) =>
          void founded.set(account, { source, sites, tier: source === "campaign" ? (tier ?? 1) : tier }),
        clear: (sites = 1) => void founded.set(account, { ...founded.get(account)!, sites }),
      };
    };
    type Player = Awaited<ReturnType<typeof player>>;
    const ticket = (tier: string) => [200, { campaign, tier }];
    /** A friend as the inviter's panel lists them: their state, and whether their ticket is golden. */
    type Listed = string | { state: string; golden: true };
    const answer = (
      home: string,
      friends: Listed[],
      {
        tier = null,
        goldenPending = false,
        linkGolden = false,
        earned = {},
      }: {
        tier?: string | null;
        goldenPending?: boolean;
        linkGolden?: boolean;
        earned?: { ticket?: boolean; golden?: boolean };
      } = {},
    ) => {
      const listed = friends.map((friend) =>
        typeof friend === "string" ? { name: null, state: friend, golden: false } : { name: null, ...friend },
      );
      return {
        code: expect.stringMatching(/^[A-HJ-NP-Z2-9]{8}$/),
        home,
        tier,
        goldenPending,
        link: { counted: listed.filter(({ state }) => state === "counted").length, golden: linkGolden },
        friends: listed,
        earned: { ticket: false, golden: false, ...earned },
      };
    };
    /** Friends that each take a ticket through the inviter's link, at the tier drawn, found a Devcon home and clear a site. */
    const countedFriends = async (inviter: Player, names: string[], tier: "regular" | "golden" = "regular") => {
      const code = await inviter.code();
      const friends: Player[] = [];
      for (const name of names) {
        const friend = await player(name);
        draws.push(tier);
        expect(await friend.redeem({ referral: code })).toEqual(ticket(tier));
        friend.found("campaign", 1, tier === "golden" ? 2 : 1);
        friends.push(friend);
      }
      return friends;
    };
    const referralRows = async (friend: Player) =>
      (
        await env.DB.prepare('SELECT "referrer" FROM "campaign_referrals" WHERE "friend" = ?')
          .bind(friend.realmsId)
          .all<{ referrer: string }>()
      ).results.map(({ referrer }) => referrer);

    it("gives a friend a ticket from their inviter's link, from no printed code, and records them once", async () => {
      const inviter = await player("ref-inviter");
      const [status, first] = await inviter.referral();
      expect([status, first]).toEqual([200, answer("free", [])]);
      expect(await inviter.code()).toBe(first.code);
      const friend = await player("ref-friend");
      expect(await friend.redeem({ referral: first.code.toLowerCase() })).toEqual(ticket("regular"));
      expect(await friend.redeem({ referral: first.code })).toEqual(ticket("regular"));
      expect(await friend.redeem()).toEqual(ticket("regular"));
      const given = await env.DB.prepare('SELECT "code_hash" FROM "campaign_tickets" WHERE "owner" = ?')
        .bind(friend.realmsId)
        .first<{ code_hash: string | null }>();
      expect(given).toEqual({ code_hash: null });
      expect(await referralRows(friend)).toEqual([inviter.realmsId]);
      expect((await inviter.referral())[1]).toEqual(answer("free", ["signed"]));

      // The inviter's own link, a second link for a friend already holding a ticket, a friend whose home has a source,
      // a code no link carries and a body naming both a flyer and a link record no one.
      expect(await inviter.redeem({ referral: first.code })).toEqual([409, { error: "self_referral" }]);
      const other = await player("ref-other");
      expect(await friend.redeem({ referral: await other.code() })).toEqual(ticket("regular"));
      expect((await other.referral())[1]).toEqual(answer("free", []));
      expect(await referralRows(friend)).toEqual([inviter.realmsId]);
      const held = await player("ref-held-friend");
      held.found("realm");
      expect(await held.redeem({ referral: first.code })).toEqual([409, { error: "realm_founded" }]);
      expect(await held.redeem({ referral: "ZZZZZZZZ" })).toEqual([404, { error: "referral_unknown" }]);
      expect(await held.redeem({ referral: first.code, code: "K7M2QX4R" })).toEqual([
        400,
        { error: "invalid_redemption" },
      ]);
      expect((await inviter.referral())[1]).toEqual(answer("free", ["signed"]));
      const signedOut = await createBrowser().request(`/api/campaigns/referral?campaign=${campaign}`);
      expect(signedOut.status).toBe(401);
    });

    it("gives one ticket and records one inviter when two links, or a link and a flyer, race for one friend", async () => {
      const [first, second] = [await player("ref-race-a"), await player("ref-race-b")];
      const [a, b] = [await first.code(), await second.code()];
      const friend = await player("ref-race-friend");
      const [one, two] = await Promise.all([friend.redeem({ referral: a }), friend.redeem({ referral: b })]);
      expect(one).toEqual(ticket("regular"));
      expect(two).toEqual(ticket("regular"));
      expect(await referralRows(friend)).toHaveLength(1);
      expect([first.realmsId, second.realmsId]).toContain((await referralRows(friend))[0]);

      const flyer = await player("ref-race-flyer");
      await env.DB.prepare(`INSERT INTO "campaign_codes" ("campaign", "code_hash", "tier") VALUES (?, ?, 'regular')`)
        .bind(campaign, await campaignCodeHash(campaign, "R4CE7FLY"))
        .run();
      const [byFlyer, byLink] = await Promise.all([flyer.redeem({ code: "R4CE7FLY" }), flyer.redeem({ referral: a })]);
      expect(byFlyer).toEqual(ticket("regular"));
      expect(byLink).toEqual(ticket("regular"));
      const won = await env.DB.prepare('SELECT "code_hash" FROM "campaign_tickets" WHERE "owner" = ?')
        .bind(flyer.realmsId)
        .first<{ code_hash: string | null }>();
      // The link records its friend only when its own write gave the ticket.
      expect(await referralRows(flyer)).toEqual(won!.code_hash === null ? [first.realmsId] : []);
    });

    it("names the inviter to a friend's landing by their chosen name only", async () => {
      const inviter = await player("ref-named");
      const code = await inviter.code();
      const landing = async (path: string) => {
        const response = await createBrowser().request(path);
        return [response.status, await response.json()];
      };
      expect(await landing(`/api/campaigns/referral/${code}?campaign=${campaign}`)).toEqual([200, { name: null }]);
      expect((await inviter.browser.request("/api/auth/update-user", { body: { name: "Maelis Vane" } })).status).toBe(
        200,
      );
      expect(await landing(`/api/campaigns/referral/${code.toLowerCase()}?campaign=${campaign}`)).toEqual([
        200,
        { name: "Maelis Vane" },
      ]);
      expect(await landing(`/api/campaigns/referral/ZZZZZZZZ?campaign=${campaign}`)).toEqual([
        404,
        { error: "referral_unknown" },
      ]);
      expect(await landing(`/api/campaigns/referral/${code}`)).toEqual([404, { error: "referral_unknown" }]);
    });

    it("counts a friend who founds and clears a site, and gives a free-home inviter one regular ticket", async () => {
      const inviter = await player("ref-free-home");
      inviter.found("free");
      const code = await inviter.code();
      const friend = await player("ref-free-friend");
      expect(await friend.redeem({ referral: code })).toEqual(ticket("regular"));
      expect((await inviter.referral())[1]).toEqual(answer("free", ["signed"]));
      friend.found("campaign");
      expect((await inviter.referral())[1]).toEqual(answer("free", ["founded"]));
      expect(await campaignTicketFor(env.DB, inviter.realmsId, 6)).toBeNull();

      // A board that cannot answer counts no one; once it answers, the friend counts.
      friend.clear();
      boardAnswers = false;
      try {
        expect((await inviter.referral())[1]).toEqual(answer("free", ["signed"]));
      } finally {
        boardAnswers = true;
      }
      expect(await campaignTicketFor(env.DB, inviter.realmsId, 6)).toBeNull();
      const [one, two] = await Promise.all([inviter.referral(), inviter.referral()]);
      expect(one[1]).toEqual(answer("ticket", ["counted"], { tier: "regular", earned: { ticket: true } }));
      expect(two[1]).toEqual(one[1]);
      expect(await campaignTicketFor(env.DB, inviter.realmsId, 6)).toEqual({ campaign, tier: "regular" });
      expect(await inviter.redeem()).toEqual(ticket("regular"));
      expect(relay).not.toHaveBeenCalled();
    });

    it("settles on the held-ticket read, so the home source picker offers a ticket friends earned", async () => {
      const inviter = await player("ref-picker");
      inviter.found("free");
      await countedFriends(inviter, ["ref-picker-friend"]);
      expect(await inviter.redeem()).toEqual(ticket("regular"));
    });

    it("counts one person once: a friend sharing a mailbox or device with the inviter or a counted friend is excluded", async () => {
      const inviter = await player("ref-alts", { email: "Ref.Alts@gmail.com" });
      inviter.found("free");
      const code = await inviter.code();
      const join = async (name: string, options: { email?: string; device?: string | null }) => {
        const friend = await player(name, options);
        expect(await friend.redeem({ referral: code })).toEqual(ticket("regular"));
        friend.found("campaign", 1);
        return friend;
      };
      // The inviter's own inbox by Gmail's dots and +tags, and the inviter's own device: neither counts.
      await join("ref-alts-mail", { email: "refalts+two@googlemail.com" });
      await join("ref-alts-device", { device: inviter.device });
      expect((await inviter.referral())[1]).toEqual(answer("free", ["excluded", "excluded"]));
      expect(await campaignTicketFor(env.DB, inviter.realmsId, 6)).toBeNull();
      // A friend of their own counts; another on that friend's device does not; one with no device yet waits for it.
      const real = await join("ref-alts-real", {});
      await join("ref-alts-copy", { device: real.device });
      const later = await join("ref-alts-later", { device: null });
      expect((await inviter.referral())[1]).toEqual(
        answer("ticket", ["excluded", "excluded", "counted", "excluded", "founded"], {
          tier: "regular",
          earned: { ticket: true },
        }),
      );
      await later.onDevice("0xfeed");
      expect((await inviter.referral())[1].friends.map(({ state }: { state: string }) => state)).toEqual([
        "excluded",
        "excluded",
        "counted",
        "excluded",
        "counted",
      ]);
    });

    it("keeps excluding a friend on the inviter's device after the inviter signs out and back in", async () => {
      const inviter = await player("ref-signout", { device: "0xa11ce" });
      inviter.found("free");
      const code = await inviter.code();
      const twin = await player("ref-signout-twin", { device: "0xa11ce" });
      expect(await twin.redeem({ referral: code })).toEqual(ticket("regular"));
      twin.found("campaign", 1);
      expect((await inviter.referral())[1]).toEqual(answer("free", ["excluded"]));
      // Sign-out deletes the inviter's session and with it every device_sessions row; signing back in registers none.
      await inviter.signOut();
      await inviter.signIn();
      const rows = await env.DB.prepare('SELECT COUNT(*) AS n FROM "device_sessions" WHERE "realmsId" = ?')
        .bind(inviter.realmsId)
        .first<{ n: number }>();
      expect(rows).toEqual({ n: 0 });
      expect((await inviter.referral())[1]).toEqual(answer("free", ["excluded"]));
      expect(await campaignTicketFor(env.DB, inviter.realmsId, 6)).toBeNull();
      // The same for a friend who approved a counted friend's device and signed out before counting.
      const real = await player("ref-signout-real");
      expect(await real.redeem({ referral: code })).toEqual(ticket("regular"));
      real.found("campaign", 1);
      const borrower = await player("ref-signout-borrow", { device: null });
      expect(await borrower.redeem({ referral: code })).toEqual(ticket("regular"));
      await borrower.onDevice(real.device!);
      await borrower.signOut();
      borrower.found("campaign", 1);
      expect((await inviter.referral())[1].friends.map(({ state }: { state: string }) => state)).toEqual([
        "excluded",
        "counted",
        "excluded",
      ]);
    });

    it("counts one person once when settlements race, each deciding from its own snapshot", async () => {
      const inviter = await player("ref-racing");
      inviter.found("free");
      const code = await inviter.code();
      const own = { mailbox: "ref-racing@realms.test", devices: [inviter.device!] };
      const store = createCampaignReferralStore(env.DB);
      const join = async (name: string, options: { email?: string; device?: string | null }) => {
        const friend = await player(name, options);
        expect(await friend.redeem({ referral: code })).toEqual(ticket("regular"));
        friend.found("campaign", 1);
        return friend;
      };
      // Shared device: an older read decided to count the later friend, a newer one the earlier; both writes land.
      const first = await join("ref-racing-a", { device: "0xdef" });
      const second = await join("ref-racing-b", { device: "0xdef" });
      await store.markCounted(campaign, inviter.realmsId, own, [{ friend: second.realmsId, deviceKey: "0xdef" }], 1);
      await store.markCounted(campaign, inviter.realmsId, own, [{ friend: first.realmsId, deviceKey: "0xdef" }], 2);
      // Shared mailbox: the same race between two aliases of one inbox, on their own devices.
      const third = await join("ref-racing-c", { email: "racer@gmail.com" });
      const fourth = await join("ref-racing-d", { email: "ra.cer+alt@gmail.com" });
      await store.markCounted(
        campaign,
        inviter.realmsId,
        own,
        [{ friend: fourth.realmsId, deviceKey: fourth.device! }],
        3,
      );
      await store.markCounted(
        campaign,
        inviter.realmsId,
        own,
        [{ friend: third.realmsId, deviceKey: third.device! }],
        4,
      );
      const counted = await env.DB.prepare(
        `SELECT "friend" FROM "campaign_referrals" WHERE "referrer" = ? AND "counted_at" IS NOT NULL ORDER BY "counted_at"`,
      )
        .bind(inviter.realmsId)
        .all<{ friend: string }>();
      expect(counted.results.map(({ friend }) => friend)).toEqual([second.realmsId, fourth.realmsId]);
      // A settling read keeps that: two counted, the others excluded, and one ticket for the inviter.
      expect((await inviter.referral())[1]).toEqual(
        answer("ticket", ["excluded", "counted", "excluded", "counted"], { tier: "regular", earned: { ticket: true } }),
      );
      // Nor does a write for the inviter's own mailbox or device count anyone.
      const self = await join("ref-racing-self", { device: inviter.device });
      await store.markCounted(
        campaign,
        inviter.realmsId,
        own,
        [{ friend: self.realmsId, deviceKey: inviter.device! }],
        5,
      );
      expect((await inviter.referral())[1].link.counted).toBe(2);
    });

    it("compares every device each friend ever approved, not only the one kept, in sequence and when writes race", async () => {
      const inviter = await player("ref-alldev");
      inviter.found("free");
      const code = await inviter.code();
      const own = { mailbox: "ref-alldev@realms.test", devices: [inviter.device!] };
      const join = async (name: string, devices: string[]) => {
        const friend = await player(name, { device: devices[0]! });
        for (const device of devices.slice(1)) await friend.onDevice(device);
        expect(await friend.redeem({ referral: code })).toEqual(ticket("regular"));
        return friend;
      };
      // In sequence: A approved 0xa1 and 0xa2 and is kept on 0xa1; it counts. B, on 0xa2 alone, qualifies on a later read.
      const a = await join("ref-alldev-a", ["0xa1", "0xa2"]);
      a.found("campaign", 1);
      expect((await inviter.referral())[1].friends.map(({ state }: { state: string }) => state)).toEqual(["counted"]);
      const b = await join("ref-alldev-b", ["0xa2"]);
      b.found("campaign", 1);
      expect((await inviter.referral())[1]).toEqual(
        answer("ticket", ["counted", "excluded"], { tier: "regular", earned: { ticket: true } }),
      );
      // Racing writes, the shared 0xc3 neither friend's kept device: the second write counts no one.
      const store = createCampaignReferralStore(env.DB);
      const c = await join("ref-alldev-c", ["0xc1", "0xc3"]);
      const d = await join("ref-alldev-d", ["0xc2", "0xc3"]);
      c.found("campaign", 1);
      d.found("campaign", 1);
      await store.markCounted(campaign, inviter.realmsId, own, [{ friend: d.realmsId, deviceKey: "0xc2" }], 10);
      await store.markCounted(campaign, inviter.realmsId, own, [{ friend: c.realmsId, deviceKey: "0xc1" }], 11);
      expect((await inviter.referral())[1]).toEqual(
        answer("ticket", ["counted", "excluded", "excluded", "counted"], { tier: "regular", earned: { ticket: true } }),
      );
    });

    it("gives a held-Realm inviter nothing, while their friends still get tickets", async () => {
      const inviter = await player("ref-held-inviter");
      inviter.found("realm");
      await countedFriends(inviter, ["ref-held-a", "ref-held-b"]);
      await countedFriends(inviter, ["ref-held-c"], "golden");
      expect((await inviter.referral())[1]).toEqual(
        answer("held", ["counted", "counted", { state: "counted", golden: true }]),
      );
      expect(await campaignTicketFor(env.DB, inviter.realmsId, 6)).toBeNull();
      expect(relay).not.toHaveBeenCalled();
    });

    it("draws a friend's ticket golden by chance, and a golden friend who counts gives a free home a golden ticket", async () => {
      const inviter = await player("ref-drop-free");
      inviter.found("free");
      const code = await inviter.code();
      const friend = await player("ref-drop-friend");
      draws.push("golden");
      expect(await friend.redeem({ referral: code })).toEqual(ticket("golden"));
      expect(await friend.redeem()).toEqual(ticket("golden"));
      expect((await inviter.referral())[1]).toEqual(answer("free", [{ state: "signed", golden: true }]));
      friend.found("campaign", 1, 2);
      relay.mockClear();
      expect((await inviter.referral())[1]).toEqual(
        answer("ticket", [{ state: "counted", golden: true }], {
          tier: "golden",
          earned: { ticket: true, golden: true },
        }),
      );
      expect(await campaignTicketFor(env.DB, inviter.realmsId, 6)).toEqual({ campaign, tier: "golden" });
      expect(relay).not.toHaveBeenCalled();
    });

    it("upgrades a regular Devcon home through the relay, and says golden only once the board shows it", async () => {
      const inviter = await player("ref-drop-home");
      inviter.found("free");
      await countedFriends(inviter, ["ref-drop-home-a"]);
      expect((await inviter.referral())[1]).toEqual(
        answer("ticket", ["counted"], { tier: "regular", earned: { ticket: true } }),
      );
      // The inviter adds the earned ticket to their free home: the board shows a regular Devcon home.
      inviter.found("campaign", 0, 1);
      expect((await inviter.referral())[1]).toEqual(
        answer("devcon", ["counted"], { tier: "regular", earned: { ticket: true } }),
      );
      await countedFriends(inviter, ["ref-drop-home-b"], "golden");
      relay.mockClear();
      relay.mockResolvedValueOnce(Response.json({ error: "upgrade_requires_release_8" }, { status: 409 }));
      const pending = answer("devcon", ["counted", { state: "counted", golden: true }], {
        tier: "golden",
        goldenPending: true,
        earned: { ticket: true, golden: true },
      });
      expect((await inviter.referral())[1]).toEqual(pending);
      expect(await campaignTicketFor(env.DB, inviter.realmsId, 6)).toEqual({ campaign, tier: "golden" });
      expect(relay).toHaveBeenCalledTimes(1);
      const [url, init] = relay.mock.calls[0]!;
      expect(new URL(String(url)).pathname).toBe("/api/value/operator/campaign-upgrade");
      expect(new Headers(init!.headers).get("authorization")).toBe(`Bearer ${OPERATOR_TOKEN}`);
      expect(JSON.parse(String(init!.body))).toEqual({ chainId: "0xd5", gameId: 41, realmsId: inviter.realmsId });
      // Refused, unreachable, or accepted but not on the board yet: still pending, and the next read asks again.
      relay.mockRejectedValueOnce(new Error("relay unreachable"));
      expect((await inviter.referral())[1]).toEqual(pending);
      expect((await inviter.referral())[1]).toEqual(pending);
      expect(relay).toHaveBeenCalledTimes(3);
      // Once the board shows the home golden, it is golden and no read asks.
      inviter.found("campaign", 0, 2);
      const golden = { ...pending, home: "golden", goldenPending: false };
      expect((await inviter.referral())[1]).toEqual(golden);
      expect(await inviter.redeem()).toEqual(ticket("golden"));
      expect(relay).toHaveBeenCalledTimes(3);
    });

    it("turns the link golden at ten counted friends: the inviter, every friend before and after, each home upgraded on its own read", async () => {
      const inviter = await player("ref-link");
      inviter.found("campaign", 0, 1);
      await env.DB.prepare(
        `INSERT INTO "campaign_tickets" ("campaign", "owner", "code_hash", "tier", "redeemed_at") VALUES (?, ?, NULL, 'regular', 1)`,
      )
        .bind(campaign, inviter.realmsId)
        .run();
      const code = await inviter.code();
      const early = await player("ref-link-signed");
      expect(await early.redeem({ referral: code })).toEqual(ticket("regular"));
      const names = Array.from({ length: CAMPAIGNS[campaign].referral.goldenLinkAt - 1 }, (_, i) => `ref-link-${i}`);
      const friends = await countedFriends(inviter, names);
      const nine = (await inviter.referral())[1];
      expect(nine.link).toEqual({ counted: 9, golden: false });
      expect(nine.tier).toBe("regular");
      const [last] = await countedFriends(inviter, ["ref-link-tenth"]);
      relay.mockClear();
      const linked = (await inviter.referral())[1];
      expect(linked).toMatchObject({
        home: "devcon",
        tier: "golden",
        goldenPending: true,
        link: { counted: 10, golden: true },
        earned: { golden: true },
      });
      expect(linked.friends.every(({ golden }: { golden: boolean }) => golden)).toBe(true);
      expect(relay).toHaveBeenCalledTimes(1);
      // Every friend's ticket is golden, counted or not; a founded friend's home upgrades on that friend's own read.
      for (const friend of [early, last!, ...friends])
        expect(await campaignTicketFor(env.DB, friend.realmsId, 6)).toEqual({ campaign, tier: "golden" });
      relay.mockClear();
      expect(await last!.redeem()).toEqual(ticket("golden"));
      expect(relay).toHaveBeenCalledTimes(1);
      expect(JSON.parse(String(relay.mock.calls[0]![1]!.body))).toEqual({
        chainId: "0xd5",
        gameId: 41,
        realmsId: last!.realmsId,
      });
      // A ticket the link gives later is golden, whatever the draw.
      const later = await player("ref-link-later");
      expect(await later.redeem({ referral: code })).toEqual(ticket("golden"));
    }, 30_000);

    it("gives no referral ticket and counts no friend after the season", async () => {
      const inviter = await player("ref-closing");
      inviter.found("free");
      const code = await inviter.code();
      const early = await player("ref-closing-early");
      expect(await early.redeem({ referral: code })).toEqual(ticket("regular"));
      early.found("campaign", 1);
      const late = await player("ref-closing-late");
      const now = vi.spyOn(Date, "now").mockReturnValue(CAMPAIGNS[campaign].redeemUntil * 1000);
      try {
        expect(await late.redeem({ referral: code })).toEqual([410, { error: "campaign_closed" }]);
        expect((await inviter.referral())[1]).toEqual(answer("free", ["signed"]));
        expect(await early.redeem()).toEqual(ticket("regular"));
      } finally {
        now.mockRestore();
      }
      expect(await campaignTicketFor(env.DB, inviter.realmsId, 6)).toBeNull();
    });
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
    await env.DB.prepare("DELETE FROM shards WHERE url = ?").bind("https://devices.realms.test").run();
    const operator = createBrowser();
    const game = (gameId: number, name: string) => ({
      game_id: gameId,
      name,
      status: "Running",
      slotId: null,
    });
    launchDirectory = {
      chains: [{ chainId: "0xa", games: [1, 3].map((gameId) => ({ gameId, slotId: null })) }],
    };
    heralds.set("https://shard-a.test/manifest", shardManifest("0xa"));
    heralds.set("https://shard-a.test/games", {
      chain: "0xa",
      games: [game(1, "calendar-season"), game(2, "harness-game"), game(3, "blitz-slot")],
    });
    heralds.set("https://shard-b.test/manifest", shardManifest("0xb"));
    heralds.set("https://shard-c.test/manifest", shardManifest("0x0a"));

    expect((await operator.request("/api/directory/shards", { body: { url: "https://shard-a.test" } })).status).toBe(
      401,
    );
    for (const url of ["https://shard-a.test", "https://shard-b.test"]) {
      expect(
        (await operator.request("/api/directory/shards/pending", { body: { url }, token: OPERATOR_TOKEN })).status,
      ).toBe(201);
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
      {
        url: "https://shard-a.test",
        chainId: "0xa",
        status: "active",
        manifest: { ...shardManifest("0xa"), chainId: normalizeStarknetAddress("0xa") },
        games: [game(1, "calendar-season"), game(3, "blitz-slot")],
      },
      {
        url: "https://shard-b.test",
        chainId: "0xb",
        status: "active",
        games: null,
        manifest: null,
        error: "unavailable",
      },
    ]);

    heralds.set("https://shard-b.test/games", { chain: "0xb", games: [game(1, "blitz-b")] });
    launchDirectory.chains.push({
      chainId: "0xb",
      games: [1].map((gameId) => ({ gameId, slotId: null })),
    });
    const listed = [
      {
        url: "https://shard-a.test",
        chainId: "0xa",
        status: "active",
        manifest: { ...shardManifest("0xa"), chainId: normalizeStarknetAddress("0xa") },
        games: [game(1, "calendar-season"), game(3, "blitz-slot")],
      },
      {
        url: "https://shard-b.test",
        chainId: "0xb",
        status: "active",
        manifest: { ...shardManifest("0xb"), chainId: normalizeStarknetAddress("0xb") },
        games: [game(1, "blitz-b")],
      },
    ];
    expect(await list()).toEqual(listed);

    // A player's standing comes from each shard as it answers that player; shard B cannot answer, and says so.
    const standing = {
      registered: true,
      settled: false,
      roster_wallet: null,
      held_realm_id: null,
      has_home_source: false,
      taken_realm_ids: [],
      structures: [],
    };
    heralds.set("https://shard-a.test/games?player=0xabc", {
      chain: "0xa",
      games: [
        { ...game(1, "calendar-season"), player_state: standing },
        { ...game(2, "harness-game"), player_state: standing },
        { ...game(3, "blitz-slot"), player_state: standing },
      ],
    });
    expect(await list("?player=0xabc")).toEqual([
      {
        ...listed[0],
        games: [
          { ...game(1, "calendar-season"), player_state: standing },
          { ...game(3, "blitz-slot"), player_state: standing },
        ],
      },
      {
        url: "https://shard-b.test",
        chainId: "0xb",
        status: "active",
        games: null,
        manifest: null,
        error: "unavailable",
      },
    ]);
    expect(await list()).toEqual(listed);
    expect((await createBrowser().request("/api/directory?player=nobody")).status).toBe(400);

    // A settled game leaves the live list; the history serves it, newest end first across shards, a page at a time.
    const settled = (gameId: number, name: string, endAt: number) => ({
      ...game(gameId, name),
      status: "Settled",
      slotId: null,
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
      expect(
        (await operator.request("/api/directory/shards/pending", { body: { url }, token: OPERATOR_TOKEN })).status,
      ).toBe(201);
      expect((await operator.request("/api/directory/shards", { body: { url }, token: OPERATOR_TOKEN })).status).toBe(
        201,
      );
    }
    launchDirectory.chains.push(
      { chainId: "0xd", games: [1, 2].map((gameId) => ({ gameId, slotId: null })) },
      { chainId: "0xe", games: [1, 2].map((gameId) => ({ gameId, slotId: null })) },
    );
    expect(await list()).toEqual([
      ...listed,
      {
        url: "https://shard-d.test",
        chainId: "0xd",
        status: "active",
        manifest: { ...shardManifest("0xd"), chainId: normalizeStarknetAddress("0xd") },
        games: [live],
      },
      {
        url: "https://shard-e.test",
        chainId: "0xe",
        status: "active",
        manifest: { ...shardManifest("0xe"), chainId: normalizeStarknetAddress("0xe") },
        games: [],
      },
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
    expect(await (await admitE()).json()).toEqual({ error: "shard_not_pending" });
    const retired = await operator.request("/api/directory/shards/status", {
      body: { url: "https://shard-e.test", status: "retired" },
      token: OPERATOR_TOKEN,
    });
    expect(retired.status).toBe(200);
    expect(
      (
        await operator.request("/api/directory/shards/pending", {
          body: { url: "https://shard-e.test" },
          token: OPERATOR_TOKEN,
        })
      ).status,
    ).toBe(201);
    const relisted = await admitE();
    expect(relisted.status).toBe(201);
    expect(await relisted.json()).toEqual({ url: "https://shard-e.test", chainId: "0xee", status: "active" });
    launchDirectory.chains.push({
      chainId: "0xee",
      games: [1].map((gameId) => ({ gameId, slotId: null })),
    });
    expect((await list()).at(-1)).toEqual({
      url: "https://shard-e.test",
      chainId: "0xee",
      status: "active",
      manifest: { ...shardManifest("0xee"), chainId: normalizeStarknetAddress("0xee") },
      games: [live],
    });
  });

  it("requires a signed-in account before writing a wallet-link nonce", async () => {
    const address = createWallet();
    const browser = createBrowser();
    expect((await browser.request("/api/auth/siws/nonce", { body: { address } })).status).toBe(401);
    const before = await env.DB.prepare(
      "SELECT count(*) AS count FROM verification WHERE identifier LIKE 'siws_%'",
    ).first<{ count: number }>();
    await signInWithCode(browser, "nonce-owner@realms.test");
    expect((await browser.request("/api/auth/siws/nonce", { body: { address } })).status).toBe(200);
    const after = await env.DB.prepare(
      "SELECT count(*) AS count FROM verification WHERE identifier LIKE 'siws_%'",
    ).first<{ count: number }>();
    expect(after!.count).toBe(before!.count + 1);
  });

  it("accepts the environment proof chain and rejects a different-chain proof before signature verification", async () => {
    const browser = createBrowser();
    await signInWithCode(browser, "wrong-chain-proof@realms.test");
    const address = createWallet();
    verifyAsWallet.mockClear();
    const refused = await proveWallet(browser, address, "link", "SN_SEPOLIA");
    expect(refused.status).toBe(401);
    expect(verifyAsWallet).not.toHaveBeenCalled();
    expect((await browser.session())!.user.address).toBeNull();
    expect((await proveWallet(browser, address, "link")).status).toBe(200);
    expect(verifyAsWallet.mock.calls.at(-1)![0].domain.chainId).toBe("SN_MAIN");
  });

  it("names an undeployed wallet without linking it or consuming its nonce", async () => {
    const browser = createBrowser();
    await signInWithCode(browser, "undeployed-wallet@realms.test");
    const address = createWallet();
    verifyAsWallet.mockRejectedValueOnce(new WalletNotDeployedError("Wallet is not deployed"));
    const refused = await proveWallet(browser, address, "link");
    expect(refused.status).toBe(400);
    expect(await refused.json()).toMatchObject({ code: "WALLET_NOT_DEPLOYED" });
    expect((await browser.session())!.user.address).toBeNull();
    expect(
      await env.DB.prepare("SELECT count(*) AS count FROM verification WHERE identifier = ?")
        .bind(`siws_${(await browser.session())!.user.realmsId}_0x${BigInt(address).toString(16)}`)
        .first<number>("count"),
    ).toBe(1);
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

  // Measured at 2.5–3.2s, this wallet lifecycle exceeds 5s under suite contention.
  it("keeps one wallet per account: unlinking frees it, and a new link replaces the account's wallet", async () => {
    const { wallet: first } = await playerWithWallet("first-holder@realms.test");
    const holder = createBrowser();
    await signInWithCode(holder, "first-holder@realms.test");
    const other = createBrowser();
    await signInWithCode(other, "second-holder@realms.test");
    expect((await proveWallet(other, first, "link")).status).toBe(409);

    expect((await holder.request("/api/auth/siws/unlink", { body: { otp: await walletCode(holder) } })).status).toBe(
      200,
    );
    expect((await holder.session())?.user.address ?? null).toBeNull();
    expect((await proveWallet(other, first, "link")).status).toBe(200);

    const second = createWallet();
    expect((await proveWallet(other, second, "link")).status).toBe(200);
    expect(BigInt((await other.session())?.user.address ?? 0)).toBe(BigInt(second));
    expect((await proveWallet(holder, first, "link")).status).toBe(200);
  }, 10_000);

  it("keeps wallet linkage in identity without a ledger readiness state or account-link stores", async () => {
    const player = createBrowser();
    await signInWithCode(player, "identity-only-link@realms.test");
    expect((await proveWallet(player, createWallet(), "link")).status).toBe(200);
    expect((await player.session())!.user).not.toHaveProperty("ledgerLink");
    expect(
      (
        await env.DB.prepare(
          "SELECT name FROM sqlite_master WHERE name IN ('dirty_account_links','ledger_link_writes')",
        ).all()
      ).results,
    ).toEqual([]);
  });

  it("requires a fresh six-digit code from the account email for every wallet mutation", async () => {
    const browser = createBrowser();
    await signInWithCode(browser, "wallet-factor@realms.test");
    const address = createWallet();
    expect((await proveWallet(browser, address, "link")).status).toBe(200);
    expect(notices).toHaveBeenLastCalledWith("wallet-factor@realms.test", expect.any(String), expect.any(String));
    for (const otp of [undefined, "12345", "1234567", "12345678", "abcdef"]) {
      expect((await browser.request("/api/auth/siws/unlink", { body: { otp } })).status).toBe(400);
    }
    const otp = await walletCode(browser);
    expect(otp).toMatch(/^\d{6}$/);
    const wrong = otp === "000000" ? "111111" : "000000";
    expect((await browser.request("/api/auth/siws/unlink", { body: { otp: wrong } })).status).toBe(400);
    expect((await browser.session())!.user.address).not.toBeNull();
    expect((await browser.request("/api/auth/siws/unlink", { body: { otp } })).status).toBe(200);
    expect(notices).toHaveBeenLastCalledWith("wallet-factor@realms.test", null, expect.any(String));
    expect((await browser.request("/api/auth/siws/unlink", { body: { otp } })).status).toBe(400);
    const expired = await walletCode(browser);
    await env.DB.prepare("UPDATE verification SET expiresAt = ? WHERE identifier = ?")
      .bind(new Date(Date.now() - 1000).toISOString(), "sign-in-otp-wallet-factor@realms.test")
      .run();
    expect((await browser.request("/api/auth/siws/unlink", { body: { otp: expired } })).status).toBe(400);
  });

  it("blocks wallet changes after three wrong codes and accepts a freshly requested code", async () => {
    const browser = createBrowser();
    const email = "wallet-guesses@realms.test";
    await signInWithCode(browser, email);
    expect((await proveWallet(browser, createWallet(), "link")).status).toBe(200);
    const address = (await browser.session())!.user.address;
    const code = await walletCode(browser);
    const wrong = code === "000000" ? "111111" : "000000";
    const unlink = (otp: string) => browser.request("/api/auth/siws/unlink", { body: { otp } });

    for (let attempt = 0; attempt < 3; attempt += 1) expect((await unlink(wrong)).status).toBe(400);
    expect((await unlink(code)).status).toBe(403);
    expect((await browser.session())!.user.address).toBe(address);

    expect(
      (
        await browser.request("/api/auth/email-otp/send-verification-otp", {
          body: { email, type: "sign-in" },
        })
      ).status,
    ).toBe(200);
    expect((await unlink(sentCodes.get(email)!)).status).toBe(200);
    expect((await browser.session())!.user.address).toBeNull();
  });

  it("consumes one code once across concurrent changes and retries undelivered notices", async () => {
    const browser = createBrowser();
    await signInWithCode(browser, "wallet-race@realms.test");
    const otp = await walletCode(browser);
    notices.mockRejectedValueOnce(new Error("provider offline"));
    const results = await Promise.all([1, 2].map(() => browser.request("/api/auth/siws/unlink", { body: { otp } })));
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM wallet_change_notices").first<number>("n")).toBe(1);
    await Effect.runPromise(deliverWalletNotices(env.DB, notices));
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM wallet_change_notices").first<number>("n")).toBe(0);
  });

  it("refuses a valid wallet signature made for another Realms account", async () => {
    const browser = createBrowser();
    await signInWithCode(browser, "wallet-binding@realms.test");
    const address = createWallet();
    const { nonce } = (await (await browser.request("/api/auth/siws/nonce", { body: { address } })).json()) as {
      nonce: string;
    };
    const message = buildSiwsMessage({
      address,
      chainId: environmentL2(env.ENVIRONMENT).chain,
      domain: new URL(ORIGIN).host,
      nonce,
      uri: ORIGIN,
      statement: payoutWalletStatement("0xdead"),
    });
    const { r, s } = ec.starkCurve.sign(
      typedData.getMessageHash(message as unknown as TypedData, address),
      walletKeys.get(BigInt(address).toString(16))!,
    );
    const response = await browser.request("/api/auth/siws/link", {
      body: {
        address,
        message: JSON.stringify(message),
        signature: [`0x${r.toString(16)}`, `0x${s.toString(16)}`],
        otp: await walletCode(browser),
      },
    });
    expect(response.status).toBe(401);
    expect((await browser.session())!.user.address).toBeNull();
  });

  it("exposes only the current linked wallet immediately after each change", async () => {
    const browser = createBrowser();
    await signInWithCode(browser, "wallet-link@realms.test");
    expect((await browser.session())!.user.address).toBeNull();
    const address = createWallet();
    expect((await proveWallet(browser, address, "link")).status).toBe(200);
    const user = (await browser.session())!.user;
    expect(user.address).toBeTruthy();
    expect(user).not.toHaveProperty("payoutWallet");
    expect((await proveWallet(browser, address, "link")).status).toBe(200);
    expect((await browser.session())!.user.walletLinkedAt).toBe(user.walletLinkedAt);
    expect((await proveWallet(browser, createWallet(), "link")).status).toBe(200);
    expect((await browser.session())!.user.address).not.toBe(user.address);
    expect((await browser.request("/api/auth/siws/unlink", { body: { otp: await walletCode(browser) } })).status).toBe(
      200,
    );
    expect((await browser.session())!.user.address).toBeNull();
  });

  it("keeps link history after replacement and unlink", async () => {
    const browser = createBrowser();
    await signInWithCode(browser, "wallet-history@realms.test");
    const first = createWallet();
    await proveWallet(browser, first, "link");
    const user = (await browser.session())!.user;
    // Historical interval fixture: the payment precedes the later wallet change.
    await env.DB.prepare("UPDATE wallet_link_history SET linked_at=? WHERE account=? AND replaced_at IS NULL")
      .bind(Date.now() - 172800000, user.realmsId)
      .run();
    const second = createWallet();
    await proveWallet(browser, second, "link");
    const stamps = () =>
      env.DB.prepare(
        `SELECT "walletLinkedAt" AS linked, CAST(unixepoch("updatedAt",'subsec')*1000 AS INTEGER) AS updated FROM "user" WHERE id=?`,
      )
        .bind(user.id)
        .first<{ linked: number | null; updated: number }>();
    const linked = await stamps();
    expect(linked!.linked).toBe(linked!.updated);
    await browser.request("/api/auth/siws/unlink", { body: { otp: await walletCode(browser) } });
    const unlinked = await stamps();
    expect(unlinked!.linked).toBeNull();
    expect(
      await env.DB.prepare(
        "SELECT replaced_at FROM wallet_link_history WHERE account=? ORDER BY linked_at DESC LIMIT 1",
      )
        .bind(user.realmsId)
        .first<number>("replaced_at"),
    ).toBe(unlinked!.updated);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS n FROM wallet_link_history WHERE account=?")
        .bind(user.realmsId)
        .first<number>("n"),
    ).toBe(2);
  });

  it("cannot bypass the wallet code through the generic account update", async () => {
    const browser = createBrowser();
    await signInWithCode(browser, "wallet-write-path@realms.test");
    const address = createWallet();
    expect((await proveWallet(browser, address, "link")).status).toBe(200);
    const before = (await browser.session())!.user;
    const proof = verifyAsWallet.mock.calls.at(-1)!;
    expect(
      (
        await browser.request("/api/auth/siws/link", {
          body: { address, message: JSON.stringify(proof[0]), signature: proof[1] },
        })
      ).status,
    ).toBe(400);
    await browser.request("/api/auth/update-user", { body: { address: createWallet(), walletLinkedAt: 0 } });
    const after = (await browser.session())!.user;
    expect(after.address).toBe(before.address);
    expect(after.walletLinkedAt).toBe(before.walletLinkedAt);
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

// Cairo fixes the Realms id and device-change vectors; the SDK derives the account address from the released class.
describe("the account's own arithmetic", () => {
  it("agrees with Cairo on the Realms id, the guardian message and the account address", () => {
    const realmsId = realmsIdOf("0x5a3c");
    expect(realmsId).toBe("0x734aaebc35ab0e92e58e896fd0ba9cbd02df71fb4eeac417c062061bfeb4c27");
    expect(
      deviceChangeHash({ chainId: CHAIN_ID, account: "0x1234", action: "REVOKE", deviceKey: "0xabc", counter: 7 }),
    ).toBe("0x6391ae16e59af5b3e7a103409189beb1ef6ac55e4a9e2c0e02898f6b7cb390a");
    expect(realmsAccountAddress(realmsId, ACCOUNT_CLASS_HASH, ec.starkCurve.getStarkKey(GUARDIAN_KEY))).toBe(
      "0x3b5a624d64098f9369e61f21d89fc5a0bf2bd3137e7123f53234db67c8af69",
    );
  });
});
