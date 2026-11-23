import { encodeChainName, environmentL2 } from "@realms-world/chain";
import { readdirSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
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
import { byteArray, CallData, constants, ec, hash, outsideExecution, typedData, type TypedData } from "starknet";
import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { Effect } from "effect";
import { deliverWalletNotices, type SendWalletNotice } from "./wallet-changes";
import { createIdentityAuth } from "./auth";
import { WalletNotDeployedError, type VerifyWalletSignature } from "./wallet-signature";
import { ACCOUNT_CLASS_HASH, type IdentityEnv } from "./env";
import { PaymasterRefusedError, type Paymaster, type WalletFee } from "./paymaster";
import { finishRecoveries, readAttemptState } from "./wallet-recovery";
import { RpcError, type ProviderInterface } from "starknet";
import type { WalletEscape } from "@realms-world/identity/wallet";
import { defaultWalletDeployment, passkeySigner, passkeySignerGuid } from "@realms-world/identity/wallet";
import { generateKeyPairSync } from "node:crypto";
import { realmsIdOf } from "./realms-id";
import { routeIdentityRequest } from "./routes";
import { sealCodeHash } from "./public-codes";
import type { User } from "better-auth";
import { accountDeletion } from "./account-deletion";
import { accountKey } from "./player-accounts";
import { settleShareInvites, shareWorldOf } from "./shares";
import { ORIGIN } from "./workerd-harness";
import { createTestD1 } from "./test-d1";
import { sealCodeFiles } from "../scripts/seal-codes";
import { orders, seasonGameName, testnetGameName } from "@bibliothecadao/types";

const GUARDIAN_KEY = "0x2dccce1da22003777062ee0870e9881b460a8b7eca276870f57c601f182136c";
const CHAIN_ID = "0x5245414c4d535f53484152445f41";

let database: ReturnType<typeof createTestD1>;
/** A cache that keeps nothing, so every directory read in these tests is fresh. */
const noCache = { match: async () => undefined, put: async () => undefined } as unknown as Cache;
const OPERATOR_TOKEN = "operator-test-token";

/** The Heralds this test's shards answer from, by URL; a missing entry answers 503, and STALLED never answers. */
const heralds = new Map<string, unknown>();
const STALLED = Symbol("stalled");
let launchDirectory: {
  chains: { chainId: string; games: { gameId: number; slotId: number | null }[] }[];
} = { chains: [] };
let seasonPhases: { phase: "frontier"; startsAt: string; endsAt: string }[] = [];
const seasonFrom = (startsAt: number) => [
  {
    phase: "frontier" as const,
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(startsAt + 86_400_000).toISOString(),
  },
];
const fetchShard = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const body = heralds.get(new URL(input instanceof Request ? input.url : input).href);
  if (body === STALLED)
    return new Promise<Response>((_, reject) =>
      init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)),
    );
  return body === undefined ? new Response("unavailable", { status: 503 }) : Response.json(body);
}) as typeof fetch;
/**
 * The game's page as its host serves it at a shared link's address: its unfurl's tags as index.html writes them once
 * built. Any other address is the host's 404.
 */
const GAME_PAGE = `<!doctype html><html><head><title>Realms</title>
<meta name="description" content="Fully onchain strategy" />
<meta property="og:title" content="Realms" />
<meta property="og:description" content="Fully onchain strategy" />
<meta property="og:image" content="${ORIGIN}/images/covers/link-preview.png" />
<meta property="og:url" content="${ORIGIN}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="${ORIGIN}/images/covers/link-preview.png" />
</head><body><div id="root"></div></body></html>`;
const fetchPage = async (request: Request) =>
  new URL(request.url).pathname.startsWith("/s/")
    ? new Response(GAME_PAGE, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } })
    : new Response("not found", { status: 404 });
/** R2 as the identity Worker uses it for shared cards, held in memory. */
const memoryBucket = () => {
  const objects = new Map<string, { bytes: Uint8Array; contentType: string | undefined }>();
  return {
    objects,
    put: async (key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }) => {
      objects.set(key, { bytes: new Uint8Array(value), contentType: options?.httpMetadata?.contentType });
      return {};
    },
    get: async (key: string) => {
      const object = objects.get(key);
      return object ? { body: new Blob([object.bytes]).stream() } : null;
    },
    head: async (key: string) => (objects.has(key) ? {} : null),
  };
};
const shareCards = memoryBucket();
const relay = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({}));
let env: IdentityEnv;
const notifierCalls: [string, string][] = [];
const notifiers = {
  idFromName: (url: string) => url,
  get: (url: string) => ({
    watch: async () => void notifierCalls.push(["watch", url]),
    stop: async () => void notifierCalls.push(["stop", url]),
  }),
};
const listShard = (url: string, chainId: string) =>
  env.DB.prepare(
    "INSERT INTO shards (slot, url, chainId) VALUES (1, ?, ?) ON CONFLICT (slot) DO UPDATE SET url = excluded.url, chainId = excluded.chainId",
  )
    .bind(url, chainId)
    .run();
let auth: ReturnType<typeof createIdentityAuth>;

/** The default wallets' paymaster, as AVNU answers: it builds what it is asked and submits what it is given; our key lets it sponsor. */
const paymaster = {
  canSponsor: true,
  build: vi.fn<Paymaster["build"]>(),
  execute: vi.fn<Paymaster["execute"]>(),
};
/** What the paymaster's build answers: the execution, and the fee the wallet pays itself (none when sponsored). */
const built = (typedData: unknown, fee: WalletFee | null = null) => ({ typedData, fee }) as never;
/** Whether the chain holds a contract at an address; default wallets start undeployed. */
const isDeployed = vi.fn(async (_address: string) => false);
/** A wallet's owner escape as the chain answers; none unless a test starts one. */
const readEscape = vi.fn(
  async (_address: string): Promise<WalletEscape> => ({ status: "none", readyAt: null, newOwner: null }),
);

/** The email provider's inbox: the last sign-in code sent to each address. */
const sentCodes = new Map<string, string>();
const notices = vi.fn<SendWalletNotice>(async () => {});
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

const MIGRATIONS = new URL("../migrations/", import.meta.url);
/** A migration file's statements, as the identity database runs them. */
const migrationStatementsOf = (file: string) =>
  readFileSync(new URL(file, MIGRATIONS), "utf8")
    .replace(/^--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
/** The last migration the name-suggestion stories below are about; later ones wait for a later deploy there. */
const THROUGH_0031 = "0031_clear_unnamed_name_suggestions.sql";
const D1_MIGRATIONS_TABLE =
  "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)";
/** Records migration files as applied without running them, as a database already past them has them. */
const markMigrationsApplied = async (db: D1Database, applied: (file: string) => boolean) => {
  await db.prepare(D1_MIGRATIONS_TABLE).run();
  const files = readdirSync(MIGRATIONS).filter((file) => file.endsWith(".sql") && applied(file));
  await db.batch(files.map((file) => db.prepare("INSERT OR IGNORE INTO d1_migrations (name) VALUES (?1)").bind(file)));
};
/**
 * What `wrangler d1 migrations apply` does: runs the migration files d1_migrations does not name, in name order, and
 * records each; files after `through` wait for a later deploy. Returns the files it ran.
 */
const applyPendingMigrations = async (db: D1Database, through?: string) => {
  await db.prepare(D1_MIGRATIONS_TABLE).run();
  const { results } = await db.prepare("SELECT name FROM d1_migrations").all<{ name: string }>();
  const applied = new Set(results.map(({ name }) => name));
  const pending = readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith(".sql") && !applied.has(file) && (through === undefined || file <= through))
    .sort();
  for (const file of pending) {
    await db.batch([
      ...migrationStatementsOf(file).map((sql) => db.prepare(sql)),
      db.prepare("INSERT INTO d1_migrations (name) VALUES (?1)").bind(file),
    ]);
  }
  return pending;
};
/** 0030 as staging ran it, before it was corrected in place: it spared every account with a Discord login. */
const ORIGINAL_0030 = `update "user" set "suggestedName" = null where "name" = "id" and "suggestedName" is not null and not exists (select 1 from "account" a where a."userId" = "user"."id" and a."providerId" = 'discord')`;
/** Whether an account is still unnamed (its name is its id), and the name the app would offer it. */
const suggestionOf = async (db: D1Database, email: string) =>
  (await db
    .prepare(`SELECT "name" = "id" AS unnamed, "suggestedName" AS suggested FROM "user" WHERE "email" = ?1`)
    .bind(email)
    .first<{ unnamed: number; suggested: string | null }>())!;

beforeAll(async () => {
  database = createTestD1();
  const statements = readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .flatMap(migrationStatementsOf);
  await database.db.batch(statements.map((statement) => database.db.prepare(statement)));
  env = {
    ENVIRONMENT: "staging",
    BASE_URL: ORIGIN,
    BETTER_AUTH_SECRET: "identity-test-secret-identity-test-secret",
    RATING_READER: {} as IdentityEnv["RATING_READER"],
    MARKETPLACE_API_URL: "https://market.test/api/marketplace",
    L2_RPC_URL: "https://starknet-mainnet.g.alchemy.com/v2/test",
    OPERATOR_TOKEN: OPERATOR_TOKEN,
    GOOGLE_CLIENT_ID: "google-client",
    GOOGLE_CLIENT_SECRET: "google-secret",
    APPLE_CLIENT_ID: "party.realms.signin.test",
    APPLE_CLIENT_SECRET: "apple-jwt",
    DISCORD_CLIENT_ID: "discord-client",
    DISCORD_CLIENT_SECRET: "discord-secret",
    TWITTER_CLIENT_ID: "x-client",
    TWITTER_CLIENT_SECRET: "x-secret",
    RESEND_API_KEY: "unused",
    WEB_PUSH_VAPID_PUBLIC_KEY: "unused",
    WEB_PUSH_VAPID_PRIVATE_KEY: "unused",
    SHARD_NOTIFIER: notifiers as unknown as IdentityEnv["SHARD_NOTIFIER"],
    CHAT_ROOM: {} as IdentityEnv["CHAT_ROOM"],
    CHAT_INBOX: {} as IdentityEnv["CHAT_INBOX"],
    DB: database.db,
    GUARDIAN: createGuardian(GUARDIAN_KEY),
    LAUNCH: {
      fetch: vi.fn(async (input: RequestInfo | URL) =>
        new URL(input instanceof Request ? input.url : input).pathname === "/api/factory/calendar"
          ? Response.json({ phases: seasonPhases })
          : Response.json({ chains: [] }),
      ),
    },
    VALUE_RELAY: { fetch: relay },
    DIRECTORY_RATE_LIMIT: { limit: async () => ({ success: true }) },
    PUBLIC_RATE_LIMIT: { limit: async () => ({ success: true }) },
    SIGN_IN_CODE_RATE_LIMIT: { limit: async ({ key }) => ({ success: countSignInCode(key) <= 3 }) },
    VERSION: { id: "test", tag: "", timestamp: "" },
    SHARE_CARDS: shareCards as unknown as IdentityEnv["SHARE_CARDS"],
  };
  auth = createIdentityAuth(env, {
    verifyWalletSignature: verifyAsWallet,
    sendWalletNotice: notices,
    sendSignInCode: async (email, code) => void sentCodes.set(email, code),
    paymaster,
    isDeployed: (address) => isDeployed(address),
    readEscape: (address) => readEscape(address),
  });
}, 60_000);

afterAll(() => database?.close());

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
  /** `file`: a body sent as itself, under its own type (an image), in place of JSON. */
  const request = async (
    path: string,
    init: { method?: string; body?: unknown; token?: string; file?: { bytes: Uint8Array; type: string } } = {},
  ) => {
    const response = await routeIdentityRequest(
      new Request(`${ORIGIN}${path}`, {
        method: init.method ?? (init.body === undefined && init.file === undefined ? "GET" : "POST"),
        headers: {
          origin: ORIGIN,
          "content-type": init.file?.type ?? "application/json",
          cookie: [...parentDomainCookies, ...[...cookies].map(([name, value]) => `${name}=${value}`)].join("; "),
          ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
        },
        ...(init.file ? { body: init.file.bytes } : init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      }),
      env,
      auth,
      {
        cache: noCache,
        fetchPage,
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

/** A Google, Apple or X account, by the authorization code its provider hands the test's browser. */
type ProviderProfile = {
  provider: "google" | "apple" | "twitter";
  id: string;
  name: string;
  /** X returns an email only when the account has a confirmed one. */
  email?: string;
  verified: boolean;
};
const providerProfiles = new Map<string, ProviderProfile>();
/** An ID token as these providers' user info reads it (decoded, not verified, after the code exchange). */
const idTokenOf = (claims: Record<string, unknown>) =>
  `${[{ alg: "none" }, claims].map((part) => Buffer.from(JSON.stringify(part)).toString("base64url")).join(".")}.sig`;
/**
 * Google's and Apple's token endpoints, answering with the ID token their user info decodes, and X's token and user
 * endpoints: X's second user lookup carries the confirmed email only when the account has one.
 */
const fakeProviders = () => {
  const passThrough = globalThis.fetch;
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const isTokenExchange = ["oauth2.googleapis.com", "appleid.apple.com", "api.x.com"].includes(url.hostname)
      ? /\/token$/.test(url.pathname)
      : false;
    if (isTokenExchange) {
      const code = new URLSearchParams(await request.text()).get("code") ?? "";
      const profile = providerProfiles.get(code);
      if (!profile) return Response.json({ error: "invalid_grant" }, { status: 400 });
      const idToken = idTokenOf({
        sub: profile.id,
        name: profile.name,
        email: profile.email,
        email_verified: profile.provider === "apple" ? String(profile.verified) : profile.verified,
      });
      return Response.json({
        access_token: `token-${code}`,
        id_token: idToken,
        token_type: "Bearer",
        expires_in: 3600,
      });
    }
    if (url.hostname === "api.x.com" && url.pathname === "/2/users/me") {
      const profile = providerProfiles.get(request.headers.get("authorization")?.replace("Bearer token-", "") ?? "");
      if (!profile) return new Response("unauthorized", { status: 401 });
      if (url.searchParams.get("user.fields") === "confirmed_email")
        return Response.json({ data: profile.verified ? { confirmed_email: profile.email } : {} });
      return Response.json({ data: { id: profile.id, name: profile.name, username: profile.name } });
    }
    return passThrough(input, init);
  });
};

/** Starts a provider's sign-in in one browser and returns from it with this profile's code, in that browser or another. */
const signInWithProvider = async (
  starter: ReturnType<typeof createBrowser>,
  profile: ProviderProfile,
  finisher = starter,
) => {
  const started = (await (
    await starter.request("/api/auth/sign-in/social", { body: { provider: profile.provider, callbackURL: "/account" } })
  ).json()) as { url: string };
  const code = `code-${profile.provider}-${profile.id}`;
  providerProfiles.set(code, profile);
  const state = new URL(started.url).searchParams.get("state");
  return finisher.request(`/api/auth/callback/${profile.provider}?code=${code}&state=${state}`);
};

/** How many accounts of one provider a user holds. */
const providerAccounts = async (userId: string, provider: string) =>
  (
    await database.db
      .prepare(`SELECT count(*) AS n FROM "account" WHERE "userId" = ? AND "providerId" = ?`)
      .bind(userId, provider)
      .first<{ n: number }>()
  )?.n;

/** The six digits the other browser's page shows. */
const handoffCodeOf = (page: string) => /class="code">(\d{6})</.exec(page)?.[1] ?? "";
const otherCode = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

const userCount = async () =>
  ((await database.db.prepare('SELECT count(*) AS n FROM "user"').first()) as { n: number }).n;

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
    await database.db
      .prepare('UPDATE "verification" SET "expiresAt" = ? WHERE "identifier" LIKE ?')
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
      const discordRows = await database.db
        .prepare(`SELECT count(*) AS n FROM "account" WHERE "userId" = ? AND "providerId" = 'discord'`)
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

      const notStarted = await safari.request("/api/auth/social-handoff", { body: { code } });
      expect(await notStarted.json()).toEqual({ code: "HANDOFF_NOT_STARTED" });
      const wrong = await app.request("/api/auth/social-handoff", { body: { code: otherCode(code) } });
      expect(await wrong.json()).toEqual({ code: "INVALID_OTP" });
      expect(await app.session()).toBeNull();

      expect((await app.request("/api/auth/social-handoff", { body: { code } })).status).toBe(200);
      expect((await app.session())?.user.email).toBe(profile.email);
      const spent = await app.request("/api/auth/social-handoff", { body: { code } });
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
        tries.push(await (await app.request("/api/auth/social-handoff", { body: { code: otherCode(code) } })).json());
      expect(tries).toEqual([{ code: "INVALID_OTP" }, { code: "INVALID_OTP" }, { code: "TOO_MANY_ATTEMPTS" }]);
      const late = await app.request("/api/auth/social-handoff", { body: { code } });
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
        Array.from({ length: 4 }, () => app.request("/api/auth/social-handoff", { body: { code } })),
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
        Array.from({ length: 3 }, () => app.request("/api/auth/social-handoff", { body: { code: otherCode(code) } })),
      );
      expect(
        (await Promise.all(wrong.map(async (reply) => ((await reply.json()) as { code: string }).code))).sort(),
      ).toEqual(["INVALID_OTP", "INVALID_OTP", "TOO_MANY_ATTEMPTS"]);
      expect((await app.request("/api/auth/social-handoff", { body: { code } })).status).toBe(400);
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
          app.request("/api/auth/social-handoff", { body: { code: each } }),
        ),
      );
      expect(claims.filter((claim) => claim.status === 200).length).toBeLessThanOrEqual(1);
      // Taken, or out of tries: either way no live hold is left to take, and a late try does not make one.
      await app.request("/api/auth/social-handoff", { body: { code: otherCode(code) } });
      const live = await database.db
        .prepare("SELECT count(*) AS n FROM social_handoffs WHERE code_hash = ?1 AND attempts < 3")
        .bind(createHash("sha256").update(code).digest("hex"))
        .first<{ n: number }>();
      expect(live?.n).toBe(0);
      expect((await app.request("/api/auth/social-handoff", { body: { code } })).status).toBe(400);
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
        database.db
          .prepare("SELECT attempts, expires_at FROM social_handoffs WHERE code_hash = ?1")
          .bind(createHash("sha256").update(code).digest("hex"))
          .first<{ attempts: number; expires_at: number }>();
      const before = await hold();
      await app.request("/api/auth/social-handoff", { body: { code: otherCode(code) } });
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
    const claim = await app.request("/api/auth/social-handoff", { body: { code: "000000" } });
    expect(await claim.json()).toEqual({ code: "OTP_EXPIRED" });
  });

  it("offers every configured provider, in the sign-in sheet's order", async () => {
    expect(await (await createBrowser().request("/api/auth/providers")).json()).toEqual({
      providers: ["google", "apple", "discord", "twitter"],
    });
  });

  it("links a Google sign-in whose verified email already has an account to that account, never a second one", async () => {
    const google = fakeProviders();
    try {
      const player = createBrowser();
      expect((await signInWithCode(player, "linked@realms.test")).status).toBe(200);
      const account = (await player.session())!.user;
      const before = await userCount();

      const phone = createBrowser();
      const profile: ProviderProfile = {
        provider: "google",
        id: "google-1",
        name: "Linked",
        email: "Linked@Realms.test",
        verified: true,
      };
      const returned = await signInWithProvider(phone, profile);
      expect(returned.headers.get("location")).toBe("/account");
      expect((await phone.session())?.user.id).toBe(account.id);
      expect(await userCount()).toBe(before);
      expect(await providerAccounts(account.id, "google")).toBe(1);
      // The next Google sign-in opens the same account through its now-linked Google login.
      await signInWithProvider(createBrowser(), profile);
      expect(await providerAccounts(account.id, "google")).toBe(1);
    } finally {
      google.mockRestore();
    }
  });

  it("refuses an X account without a confirmed email, and links one with a confirmed email to its account", async () => {
    const x = fakeProviders();
    try {
      const before = await userCount();
      const unconfirmed: ProviderProfile = { provider: "twitter", id: "x-1", name: "nomail", verified: false };
      const refused = await signInWithProvider(createBrowser(), unconfirmed);
      expect(refused.headers.get("location")).toContain("error=email_not_verified");
      expect(await userCount()).toBe(before);

      const player = createBrowser();
      expect((await signInWithCode(player, "xplayer@realms.test")).status).toBe(200);
      const account = (await player.session())!.user;
      const confirmed: ProviderProfile = {
        provider: "twitter",
        id: "x-2",
        name: "xp",
        email: "xplayer@realms.test",
        verified: true,
      };
      const phone = createBrowser();
      await signInWithProvider(phone, confirmed);
      expect((await phone.session())?.user.id).toBe(account.id);
      expect(await providerAccounts(account.id, "twitter")).toBe(1);
    } finally {
      x.mockRestore();
    }
  });

  it("holds a Google sign-in finished in another browser behind the same one-time code as every provider", async () => {
    const google = fakeProviders();
    try {
      const app = createBrowser();
      const safari = createBrowser();
      const profile: ProviderProfile = {
        provider: "google",
        id: "google-2",
        name: "Away",
        email: "away@realms.test",
        verified: true,
      };
      const shown = await signInWithProvider(app, profile, safari);
      expect(shown.status).toBe(200);
      expect(await safari.session()).toBeNull();
      const code = handoffCodeOf(await shown.text());
      expect((await app.request("/api/auth/social-handoff", { body: { code } })).status).toBe(200);
      expect((await app.session())?.user.email).toBe("away@realms.test");
    } finally {
      google.mockRestore();
    }
  });

  it("signs in the browser that started Apple when Apple posts its answer from its own origin", async () => {
    const apple = fakeProviders();
    try {
      const iphone = createBrowser();
      const started = (await (
        await iphone.request("/api/auth/sign-in/social", { body: { provider: "apple", callbackURL: "/account" } })
      ).json()) as { url: string };
      const state = new URL(started.url).searchParams.get("state")!;
      const code = "code-apple-1";
      providerProfiles.set(code, {
        provider: "apple",
        id: "apple-1",
        name: "",
        email: "orchard@realms.test",
        verified: true,
      });
      // A cross-site POST carries none of our SameSite=Lax cookies, only a SameSite=None one such as Cloudflare's.
      const posted = await routeIdentityRequest(
        new Request(`${ORIGIN}/api/auth/callback/apple`, {
          method: "POST",
          headers: {
            origin: "https://appleid.apple.com",
            "content-type": "application/x-www-form-urlencoded",
            cookie: "__cf_bm=cloudflare",
          },
          body: new URLSearchParams({ code, state }).toString(),
        }),
        env,
        auth,
        {
          cache: noCache,
          fetchPage,
          fetchShard,
          readLaunchDirectory: async () => launchDirectory,
        },
      );
      expect(posted.status).toBe(302);
      const followed = new URL(posted.headers.get("location")!);
      expect(followed.pathname).toBe("/api/auth/callback/apple");
      // The redirect is a top-level GET in the starting browser: its own cookies, the start cookie among them, go along.
      const returned = await iphone.request(`${followed.pathname}${followed.search}`);
      expect(returned.status).toBe(302);
      expect(returned.headers.get("location")).toBe("/account");
      expect((await iphone.session())?.user.email).toBe("orchard@realms.test");
    } finally {
      apple.mockRestore();
    }
  });

  it("gives Discord's website its usual address: a computer signs in as before, only a phone's app link asks for consent", async () => {
    const started = (await (
      await createBrowser().request("/api/auth/sign-in/social", { body: { provider: "discord", callbackURL: "/" } })
    ).json()) as { url: string };
    const address = new URL(started.url);
    expect(`${address.origin}${address.pathname}`).toBe("https://discord.com/api/oauth2/authorize");
    expect(address.searchParams.get("response_type")).toBe("code");
    expect(address.searchParams.get("prompt")).toBe("none");
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
    await database.db.prepare('UPDATE "user" SET "emailVerified" = 0 WHERE "id" = ?').bind(user.id).run();
    const refused = await browser.request("/api/devices", { body: deviceChangeFor(user.realmsId) });
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ error: "account_not_secured" });
  });

  it("signs a player's change only for the listed chain, a bot's first device on any shard chain, and neither on Starknet", async () => {
    const browser = createBrowser();
    await signInWithCode(browser, "chain-allow-list@realms.test");
    const player = deviceChangeFor((await browser.session())!.user.realmsId);
    const bot = {
      ...player,
      label: "0xb07",
      account: realmsAccountAddress(botRealmsId("0xb07"), ACCOUNT_CLASS_HASH, await env.GUARDIAN.publicKey()),
    };
    const signing = vi.spyOn(env.GUARDIAN, "signDeviceChange");
    const ask = async (path: string, change: object, chainId: string) => {
      signing.mockClear();
      const response = await browser.request(path, { body: { ...change, chainId }, token: OPERATOR_TOKEN });
      return { status: response.status, body: await response.json(), signed: signing.mock.calls.length };
    };
    try {
      await listShard("https://devices.realms.test", CHAIN_ID);
      const listed = `0x0${CHAIN_ID.slice(2)}`;
      expect((await ask("/api/devices", player, listed)).signed).toBe(1);
      expect((await ask("/api/devices/bots", bot, listed)).signed).toBe(1);
      await env.DB.prepare("DELETE FROM shards").run();
      expect(await ask("/api/devices", player, listed)).toEqual({
        status: 403,
        body: { error: "chain_not_approved" },
        signed: 0,
      });
      const unlisted = await ask("/api/devices/bots", bot, "0x123");
      expect([unlisted.status, unlisted.signed]).toEqual([200, 1]);
      for (const chainId of Object.values(constants.StarknetChainId)) {
        await listShard("https://devices.realms.test", chainId);
        for (const [path, change] of [
          ["/api/devices", player],
          ["/api/devices/bots", bot],
        ] as const)
          expect(await ask(path, change, chainId)).toEqual({
            status: 403,
            body: { error: "chain_not_approved" },
            signed: 0,
          });
      }
    } finally {
      signing.mockRestore();
      await listShard("https://devices.realms.test", CHAIN_ID);
    }
  });

  it("registers one shard in place of any other and removes it, each to the same end when run twice", async () => {
    const operator = createBrowser();
    const first = "https://first-shard.test";
    const second = "https://second-shard.test";
    heralds.set(`${first}/manifest`, shardManifest("0x123abc"));
    heralds.set(`${second}/manifest`, shardManifest("0x456def"));
    const register = (url: string, token?: string) =>
      operator.request("/api/directory/shard", { method: "PUT", body: { url }, ...(token ? { token } : {}) });
    const remove = () => operator.request("/api/directory/shard", { method: "DELETE", token: OPERATOR_TOKEN });
    const listed = async () =>
      (await (await operator.request("/api/directory/shard", { token: OPERATOR_TOKEN })).json()) as unknown;
    const rows = async () =>
      (await env.DB.prepare("SELECT url, chainId FROM shards").all<{ url: string; chainId: string }>()).results;
    expect((await register(first)).status).toBe(401);
    expect((await operator.request("/api/directory/shard")).status).toBe(401);
    expect((await operator.request("/api/directory/shard", { method: "DELETE" })).status).toBe(401);
    onTestFinished(() => listShard("https://devices.realms.test", CHAIN_ID).then(() => undefined));
    await env.DB.prepare("DELETE FROM shards").run();
    notifierCalls.length = 0;
    for (const url of [first, second, second]) expect((await register(url, OPERATOR_TOKEN)).status).toBe(200);
    expect(await listed()).toEqual({ shard: { url: second, chainId: "0x456def" } });
    expect(await rows()).toEqual([{ url: second, chainId: "0x456def" }]);
    for (let run = 0; run < 2; run += 1) expect(await (await remove()).json()).toEqual({ shard: null });
    expect(await listed()).toEqual({ shard: null });
    expect(await rows()).toEqual([]);
    expect(notifierCalls).toEqual([
      ["watch", first],
      ["stop", first],
      ["watch", second],
      ["watch", second],
      ["stop", second],
    ]);
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

  it("keeps an account's opening progress as sets that any device can add to again, and shows it to its owner only", async () => {
    const browser = createBrowser();
    await signInWithCode(browser, "opening@realms.test");
    const add = (body: unknown) => browser.request("/api/opening", { body });

    expect(await (await browser.request("/api/opening")).json()).toEqual({ reached: [], seen: [] });
    expect(await (await add({ reached: ["launch", "barracks"], seen: ["launch"] })).json()).toEqual({
      reached: ["barracks", "launch"],
      seen: ["launch"],
    });
    expect(await (await add({ reached: ["barracks", "fight"] })).json()).toEqual({
      reached: ["barracks", "fight", "launch"],
      seen: ["launch"],
    });
    expect((await add({ reached: ["Not A Name"] })).status).toBe(400);
    expect((await add({ seen: "launch" })).status).toBe(400);
    expect((await createBrowser().request("/api/opening")).status).toBe(401);
  });

  it("keeps each account's Order once the season has started, changed only to another Order of its Aspect, and counts every Order's members", async () => {
    seasonPhases = seasonFrom(Date.now() - 1_000);
    const first = createBrowser();
    await signInWithCode(first, "order-one@realms.test");
    const second = createBrowser();
    await signInWithCode(second, "order-two@realms.test");
    const choose = (browser: typeof first, body: unknown) => browser.request("/api/order-intent", { body });

    expect(await (await first.request("/api/order-intent")).json()).toEqual({ order: null, members: {} });
    expect(await (await choose(first, { order: 4 })).json()).toEqual({ order: 4, members: { 4: 1 } });
    expect(await (await choose(second, { order: 4 })).json()).toEqual({ order: 4, members: { 4: 2 } });
    expect(await (await choose(first, { order: 5 })).json()).toEqual({ order: 5, members: { 4: 1, 5: 1 } });
    const otherAspect = await choose(first, { order: 16 });
    expect([otherAspect.status, await otherAspect.json()]).toEqual([409, { error: "aspect_chosen" }]);
    expect(await (await second.request("/api/order-intent")).json()).toEqual({ order: 4, members: { 4: 1, 5: 1 } });
    expect((await choose(first, { order: 17 })).status).toBe(400);
    expect((await choose(first, { order: 0 })).status).toBe(400);
    expect((await choose(first, { order: "4" })).status).toBe(400);
    expect((await createBrowser().request("/api/order-intent")).status).toBe(401);
    seasonPhases = [];
  });

  it("lets an account change its Order to any Aspect's until the season starts, and only within its Aspect from the start", async () => {
    const player = createBrowser();
    await signInWithCode(player, "order-change@realms.test");
    const choose = (body: unknown) => player.request("/api/order-intent", { body });
    seasonPhases = seasonFrom(Date.now() + 3_600_000);
    expect(await (await choose({ order: 4 })).json()).toMatchObject({ order: 4 });
    expect(await (await choose({ order: 16 })).json()).toMatchObject({ order: 16 });
    seasonPhases = seasonFrom(Date.now() - 1_000);
    const afterStart = await choose({ order: 4 });
    expect([afterStart.status, await afterStart.json()]).toEqual([409, { error: "aspect_chosen" }]);
    expect(await (await player.request("/api/order-intent")).json()).toMatchObject({ order: 16 });
    seasonPhases = [];
  });

  it("holds one free Seal code on an account: case-blind, the same answer again, none from a taken, expired or unknown code, and no code spent on an account that has the Seal", async () => {
    const { codes, sql } = await sealCodeFiles(
      { label: "playtest", count: 3, expiresAt: null },
      "a seed of at least thirty-two secret characters",
    );
    const [alpha, brave, charm] = codes as [string, string, string];
    const runOperatorFile = async () => {
      for (const statement of sql.split(";\n").filter((each) => each.trim() !== ""))
        await env.DB.prepare(statement).run();
    };
    await runOperatorFile();
    await runOperatorFile();
    await env.DB.prepare('INSERT INTO "seal_codes" ("code_hash", "label", "expires_at") VALUES (?, ?, 1)')
      .bind(await sealCodeHash("LATE2345"), "playtest")
      .run();
    const player = async (name: string) => {
      const browser = createBrowser();
      await signInWithCode(browser, `${name}@realms.test`);
      const redeem = async (code: unknown) => {
        const response = await browser.request("/api/seal-code", { body: { code } });
        return [response.status, await response.json()];
      };
      const held = async () => (await browser.request("/api/seal-code")).json();
      return { redeem, held, realmsId: (await browser.session())!.user.realmsId };
    };
    const first = await player("seal-one");
    const second = await player("seal-two");
    const third = await player("seal-three");

    expect(await first.held()).toEqual({ held: false });
    expect(await first.redeem(` ${alpha.toLowerCase()} `)).toEqual([200, { held: true }]);
    expect(await first.redeem(alpha)).toEqual([200, { held: true }]);
    expect(await first.redeem(brave)).toEqual([200, { held: true }]);
    expect(await first.held()).toEqual({ held: true });
    expect(await second.redeem(alpha)).toEqual([410, { error: "code_unavailable" }]);
    expect(await second.held()).toEqual({ held: false });
    expect(await second.redeem(brave)).toEqual([200, { held: true }]);
    expect(await third.redeem("LATE2345")).toEqual([410, { error: "code_unavailable" }]);
    expect(await third.redeem("UNKN2345")).toEqual([410, { error: "code_unavailable" }]);
    expect(await third.redeem("NOPE")).toEqual([400, { error: "invalid_code" }]);
    expect(await third.redeem(42)).toEqual([400, { error: "invalid_code" }]);
    expect(await first.redeem(charm)).toEqual([200, { held: true }]);
    expect(await third.redeem(charm)).toEqual([200, { held: true }]);
    expect((await createBrowser().request("/api/seal-code")).status).toBe(401);
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

  it("lists the shard's live games, its settled ones in a paged history, a player's standing when asked, names the shard while it cannot be read, refuses another guardian's shard, and lists a replacing shard", async () => {
    const operator = createBrowser();
    const register = (url: string) =>
      operator.request("/api/directory/shard", { method: "PUT", body: { url }, token: OPERATOR_TOKEN });
    const game = (gameId: number, name: string) => ({
      game_id: gameId,
      name,
      status: "Running",
      slotId: null,
    });
    const settled = (gameId: number, name: string, endAt: number) => ({
      ...game(gameId, name),
      status: "Settled",
      slotId: null,
      clock: { end_at: endAt },
    });
    const live = { ...game(1, "calendar-season"), clock: { end_at: 900 } };
    launchDirectory = {
      chains: [{ chainId: "0xa", games: [1, 3, 4, 5].map((gameId) => ({ gameId, slotId: null })) }],
    };
    heralds.set("https://shard-a.test/manifest", shardManifest("0xa"));
    expect(await (await register("https://shard-a.test")).json()).toEqual({
      shard: { url: "https://shard-a.test", chainId: "0xa" },
    });
    heralds.set("https://shard-f.test/manifest", { ...shardManifest("0xf"), guardianPublicKey: "0x5eed" });
    expect(await (await register("https://shard-f.test")).json()).toEqual({ error: "account_identity_differs" });

    const list = async (query = "") =>
      ((await (await createBrowser().request(`/api/directory${query}`)).json()) as { shard: unknown }).shard;
    expect(await list()).toEqual({
      url: "https://shard-a.test",
      chainId: "0xa",
      games: null,
      manifest: null,
      error: "unavailable",
    });

    heralds.set("https://shard-a.test/games", {
      chain: "0xa",
      games: [
        live,
        game(2, "harness-game"),
        game(3, "blitz-slot"),
        settled(4, "a-first", 100),
        settled(5, "a-last", 300),
      ],
    });
    const listed = {
      url: "https://shard-a.test",
      chainId: "0xa",
      manifest: { ...shardManifest("0xa"), chainId: normalizeStarknetAddress("0xa") },
      games: [live, game(3, "blitz-slot")],
    };
    expect(await list()).toEqual(listed);

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
        { ...live, player_state: standing },
        { ...game(2, "harness-game"), player_state: standing },
        { ...game(3, "blitz-slot"), player_state: standing },
        { ...settled(4, "a-first", 100), player_state: { ...standing, registered: false } },
        { ...settled(5, "a-last", 300), player_state: standing },
      ],
    });
    expect(await list("?player=0xabc")).toEqual({
      ...listed,
      games: [
        { ...live, player_state: standing },
        { ...game(3, "blitz-slot"), player_state: standing },
      ],
    });
    expect(await list()).toEqual(listed);
    expect((await createBrowser().request("/api/directory?player=nobody")).status).toBe(400);

    const history = async (query: string) =>
      (await (await createBrowser().request(`/api/directory/history${query}`)).json()) as {
        games: { name: string; chainId: string; shardUrl: string }[];
        next: string | null;
        failures: { url: string }[];
      };
    const first = await history("?limit=1");
    expect(first.games.map(({ name, chainId, shardUrl }) => [name, chainId, shardUrl])).toEqual([
      ["a-last", "0xa", "https://shard-a.test"],
    ]);
    expect(first.next).toBe("300:0xa:5");
    const second = await history(`?limit=1&cursor=${first.next}`);
    expect(second.games.map(({ name }) => name)).toEqual(["a-first"]);
    expect(second.next).toBeNull();
    expect(second.failures).toEqual([]);
    expect((await history("?player=0xabc")).games.map(({ name }) => name)).toEqual(["a-last"]);
    heralds.delete("https://shard-a.test/games?player=0xabc");
    expect(await history("?player=0xabc")).toEqual({
      games: [],
      next: null,
      failures: [{ url: "https://shard-a.test", error: "unavailable" }],
    });
    for (const query of ["?limit=0", "?limit=101", "?cursor=bogus", "?player=nobody"]) {
      expect((await createBrowser().request(`/api/directory/history${query}`)).status).toBe(400);
    }

    heralds.set("https://shard-e.test/manifest", shardManifest("0xe"));
    heralds.set("https://shard-e.test/games", { chain: "0xe", games: [live] });
    launchDirectory.chains.push({ chainId: "0xe", games: [{ gameId: 1, slotId: null }] });
    expect((await register("https://shard-e.test")).status).toBe(200);
    expect(await list()).toEqual({
      url: "https://shard-e.test",
      chainId: "0xe",
      manifest: { ...shardManifest("0xe"), chainId: normalizeStarknetAddress("0xe") },
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
    expect(notices).toHaveBeenLastCalledWith(
      "wallet-factor@realms.test",
      expect.any(String),
      expect.any(String),
      "payout",
    );
    for (const otp of [undefined, "12345", "1234567", "12345678", "abcdef"]) {
      expect((await browser.request("/api/auth/siws/unlink", { body: { otp } })).status).toBe(400);
    }
    const otp = await walletCode(browser);
    expect(otp).toMatch(/^\d{6}$/);
    const wrong = otp === "000000" ? "111111" : "000000";
    expect((await browser.request("/api/auth/siws/unlink", { body: { otp: wrong } })).status).toBe(400);
    expect((await browser.session())!.user.address).not.toBeNull();
    expect((await browser.request("/api/auth/siws/unlink", { body: { otp } })).status).toBe(200);
    expect(notices).toHaveBeenLastCalledWith("wallet-factor@realms.test", null, expect.any(String), "payout");
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

  it("suggests a new player's display name from their Discord name, and nothing from their email", async () => {
    const byEmail = createBrowser();
    await signInWithCode(byEmail, "ser.galen+play@realms.test");
    expect((await byEmail.session())?.user.suggestedName).toBeNull();

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

  it("repairs through 0031 an email account linked to Discord where the original 0030 already ran, and its next sign-in has nothing to claim", async () => {
    const unnamed = createBrowser();
    await signInWithCode(unnamed, "old.unnamed@realms.test");
    const named = createBrowser();
    await signInWithCode(named, "old.named@realms.test");
    expect((await named.request("/api/auth/update-user", { body: { name: "oldnamed" } })).status).toBe(200);
    const linked = createBrowser();
    await signInWithCode(linked, "john.private@realms.test");
    const linkedId = (await linked.session())!.user.id;
    // Accounts made before email suggestions ended were suggested their email's local part.
    const suggest = (email: string, name: string) =>
      database.db.prepare(`UPDATE "user" SET "suggestedName" = ?1 WHERE "email" = ?2`).bind(name, email).run();
    await suggest("old.unnamed@realms.test", "oldunnamed");
    await suggest("old.named@realms.test", "oldnamed");
    await suggest("john.private@realms.test", "johnprivate");
    const johnOnDiscord = {
      id: "80351110224678915",
      username: "jp_rook",
      email: "john.private@realms.test",
      verified: true,
    };
    const discord = fakeDiscord();
    try {
      await signInWithDiscord(createBrowser(), {
        id: "80351110224678914",
        username: "old_rook",
        email: "rook@discord.test",
        verified: true,
      });
      // The email account signs in with Discord: the same account, now with a Discord login, still suggested its
      // email's local part.
      const viaDiscord = createBrowser();
      await signInWithDiscord(viaDiscord, johnOnDiscord);
      expect((await viaDiscord.session())?.user).toMatchObject({ id: linkedId, suggestedName: "johnprivate" });
    } finally {
      discord.mockRestore();
    }

    // Staging's history: the schema 0001–0029 leave, then 0030 as first merged (cfd96fd4a4b), which spared any account
    // with a Discord login, all recorded as applied.
    await markMigrationsApplied(database.db, (file) => file <= "0030_no_email_name_suggestion.sql");
    await database.db.exec(ORIGINAL_0030);
    expect(await suggestionOf(database.db, "john.private@realms.test")).toEqual({
      unnamed: 1,
      suggested: "johnprivate",
    });
    // The next deploy runs only what is pending: 0031.
    expect(await applyPendingMigrations(database.db, THROUGH_0031)).toEqual([THROUGH_0031]);
    const cleared = async () => {
      expect(await suggestionOf(database.db, "john.private@realms.test")).toEqual({ unnamed: 1, suggested: null });
      expect(await suggestionOf(database.db, "old.unnamed@realms.test")).toEqual({ unnamed: 1, suggested: null });
      // A Discord account not yet named cannot be told from a linked one: it picks its name too.
      expect(await suggestionOf(database.db, "rook@discord.test")).toEqual({ unnamed: 1, suggested: null });
      expect(await suggestionOf(database.db, "old.named@realms.test")).toEqual({ unnamed: 0, suggested: "oldnamed" });
    };
    await cleared();
    // A repeat deploy has nothing pending, and 0031 run again, as after a crash halfway, changes nothing.
    expect(await applyPendingMigrations(database.db, THROUGH_0031)).toEqual([]);
    await database.db.batch(
      migrationStatementsOf("0031_clear_unnamed_name_suggestions.sql").map((sql) => database.db.prepare(sql)),
    );
    await cleared();
    expect((await named.session())?.user.name).toBe("oldnamed");

    // The linked account's next sign-in: still unnamed (nothing named it by itself), with no suggestion for the app to
    // claim, so the app asks for a name (connect-flow.test.tsx) and the email's local part is never published.
    const again = fakeDiscord();
    try {
      const nextVisit = createBrowser();
      await signInWithDiscord(nextVisit, johnOnDiscord);
      expect((await nextVisit.session())?.user).toMatchObject({ id: linkedId, name: linkedId, suggestedName: null });
    } finally {
      again.mockRestore();
    }
  });

  it("keeps every shared link, visit and join through 0052, and then lets an Aspect invite, and only one, name no game", async () => {
    const fresh = createTestD1();
    try {
      await applyPendingMigrations(fresh.db, "0051_seal_codes.sql");
      const user = (id: string, realmsId: string) =>
        fresh.db
          .prepare(
            `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt", "realmsId") VALUES (?1, ?1, ?1 || '@realms.test', 1, 1, 1, ?2)`,
          )
          .bind(id, realmsId);
      await fresh.db.batch([
        user("sharer", "0x1"),
        user("friend", "0x2"),
        fresh.db.prepare(
          `INSERT INTO "share_links" ("code", "sharer", "kind", "chain_id", "game_id", "moment", "created_at", "posted_at") VALUES ('DAYL1NK2', '0x1', 'frontier-day', '0x5', 7, 3, 10, 11)`,
        ),
        fresh.db.prepare(
          `INSERT INTO "share_visits" ("code", "browser", "at", "via") VALUES ('DAYL1NK2', 'browser-1', '2026-11-01T00:00:00.000Z', 'x')`,
        ),
        fresh.db.prepare(`INSERT INTO "share_joins" ("friend", "code", "joined_at") VALUES ('0x2', 'DAYL1NK2', 12)`),
      ]);

      expect(await applyPendingMigrations(fresh.db, "0052_season_invites.sql")).toEqual(["0052_season_invites.sql"]);
      expect((await fresh.db.prepare(`SELECT * FROM "share_links"`).all()).results).toEqual([
        {
          code: "DAYL1NK2",
          sharer: "0x1",
          kind: "frontier-day",
          chain_id: "0x5",
          game_id: 7,
          moment: 3,
          created_at: 10,
          posted_at: 11,
        },
      ]);
      expect((await fresh.db.prepare(`SELECT * FROM "share_visits"`).all()).results).toEqual([
        { code: "DAYL1NK2", browser: "browser-1", at: "2026-11-01T00:00:00.000Z", via: "x" },
      ]);
      expect((await fresh.db.prepare(`SELECT * FROM "share_joins"`).all()).results).toEqual([
        { friend: "0x2", code: "DAYL1NK2", joined_at: 12, activated_at: null },
      ]);

      const link = (code: string, kind: string, chainId: string | null, gameId: number | null) =>
        fresh.db
          .prepare(
            `INSERT INTO "share_links" ("code", "sharer", "kind", "chain_id", "game_id", "moment", "created_at") VALUES (?, '0x1', ?, ?, ?, 1, 20)`,
          )
          .bind(code, kind, chainId, gameId)
          .run();
      await link("SEASON22", "aspect", null, null);
      await expect(link("SEASON33", "aspect", null, null)).rejects.toThrow(/UNIQUE/);
      await expect(link("SEASON44", "frontier-day", null, null)).rejects.toThrow(/CHECK/);
      await expect(link("SEASON55", "aspect", "0x5", null)).rejects.toThrow(/CHECK/);
    } finally {
      await fresh.close();
    }
  });

  it("folds the directory to its one serving row at 0053, and to none when two chains serve", async () => {
    const directoryAfter0053 = async (rows: [url: string, chainId: string, status: string][]) => {
      const fresh = createTestD1();
      try {
        await applyPendingMigrations(fresh.db, "0052_season_invites.sql");
        await fresh.db.batch(
          rows.map(([url, chainId, status]) =>
            fresh.db
              .prepare(`INSERT INTO "shards" ("url", "chainId", "status", "addedAt") VALUES (?1, ?2, ?3, 1)`)
              .bind(url, chainId, status),
          ),
        );
        expect(await applyPendingMigrations(fresh.db, "0053_one_shard.sql")).toEqual(["0053_one_shard.sql"]);
        return (await fresh.db.prepare(`SELECT "slot", "chainId", "url" FROM "shards"`).all()).results;
      } finally {
        await fresh.close();
      }
    };
    expect(
      await directoryAfter0053([
        ["https://herald.dev.test", "0xd0", "active"],
        ["https://herald-s1.dev.test", "0x51", "active"],
      ]),
    ).toEqual([]);
    expect(
      await directoryAfter0053([
        ["https://herald.dev.test", "0xd0", "retired"],
        ["https://herald-s1.dev.test", "0x51", "draining"],
      ]),
    ).toEqual([{ slot: 1, chainId: "0x51", url: "https://herald-s1.dev.test" }]);
  });

  it("leaves 0031 nothing to change where the corrected 0030 ran, on a database brought up fresh, and again on a repeat", async () => {
    const fresh = createTestD1();
    try {
      // Brought up from nothing by pending-only applies, as production stands (0027) before 0030 and 0031 run.
      const upTo0029 = await applyPendingMigrations(fresh.db, "0029_referral_browsers.sql");
      expect(upTo0029.at(-1)).toBe("0029_referral_browsers.sql");
      const accounts: [id: string, name: string, email: string, suggested: string, discord: boolean][] = [
        ["email", "email", "jane.private@realms.test", "janeprivate", false],
        ["linked", "linked", "john.private@realms.test", "johnprivate", true],
        ["discord", "discord", "rook@discord.test", "rook", true],
        ["named", "ChosenName", "named@realms.test", "named", false],
      ];
      await fresh.db.batch(
        accounts.flatMap(([id, name, email, suggested, discord]) => [
          fresh.db
            .prepare(
              `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt", "suggestedName") VALUES (?1, ?2, ?3, 1, 1, 1, ?4)`,
            )
            .bind(id, name, email, suggested),
          ...(discord
            ? [
                fresh.db
                  .prepare(
                    `INSERT INTO "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt") VALUES (?1, ?1, 'discord', ?2, 1, 1)`,
                  )
                  .bind(`discord-${id}`, id),
              ]
            : []),
        ]),
      );
      const cleared = async () => {
        expect(await suggestionOf(fresh.db, "jane.private@realms.test")).toEqual({ unnamed: 1, suggested: null });
        expect(await suggestionOf(fresh.db, "john.private@realms.test")).toEqual({ unnamed: 1, suggested: null });
        expect(await suggestionOf(fresh.db, "rook@discord.test")).toEqual({ unnamed: 1, suggested: null });
        expect(await suggestionOf(fresh.db, "named@realms.test")).toEqual({ unnamed: 0, suggested: "named" });
      };
      // The corrected 0030 already clears every unnamed account, the Discord-linked one included.
      expect(await applyPendingMigrations(fresh.db, "0030_no_email_name_suggestion.sql")).toEqual([
        "0030_no_email_name_suggestion.sql",
      ]);
      await cleared();
      const before = (await fresh.db.prepare(`SELECT "id", "name", "suggestedName" FROM "user" ORDER BY "id"`).all())
        .results;
      // 0031 then finds nothing to change, nor does a repeat deploy or 0031 run again.
      expect(await applyPendingMigrations(fresh.db, THROUGH_0031)).toEqual([THROUGH_0031]);
      expect(await applyPendingMigrations(fresh.db, THROUGH_0031)).toEqual([]);
      await fresh.db.batch(
        migrationStatementsOf("0031_clear_unnamed_name_suggestions.sql").map((sql) => fresh.db.prepare(sql)),
      );
      expect(
        (await fresh.db.prepare(`SELECT "id", "name", "suggestedName" FROM "user" ORDER BY "id"`).all()).results,
      ).toEqual(before);
    } finally {
      fresh.close();
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

describe("default wallet", () => {
  /** A passkey as the browser makes it: its id and its P-256 public key as a SubjectPublicKeyInfo, base64url. */
  const makePasskey = () => {
    const { publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    return {
      credentialId: Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64url"),
      publicKey: Buffer.from(publicKey.export({ format: "der", type: "spki" })).toString("base64url"),
      x: `0x${BigInt(`0x${Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url").toString("hex")}`).toString(16)}`,
    };
  };
  const newPlayer = async () => {
    const browser = createBrowser();
    await signInWithCode(browser, `wallet-${crypto.randomUUID()}@realms.test`);
    return browser;
  };
  const create = (browser: ReturnType<typeof createBrowser>, body: Record<string, unknown>) =>
    browser.request("/api/auth/wallet/default", { body });
  const withWallet = async () => {
    const browser = await newPlayer();
    const passkey = makePasskey();
    const created = await create(browser, {
      passkey: { credentialId: passkey.credentialId, publicKey: passkey.publicKey },
    });
    expect(created.status).toBe(200);
    const { wallet } = (await created.json()) as { wallet: { address: string } };
    return { browser, passkey, wallet };
  };
  const LORDS = "0x124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49";
  const transfer = { contractAddress: LORDS, entrypoint: "transfer", calldata: ["0x5", "0x64", "0x0"] };
  const executionFor = (calls = [transfer], nonce = "0x99") =>
    outsideExecution.getTypedData(
      encodeChainName(environmentL2(env.ENVIRONMENT).chain),
      { caller: "0x414e595f43414c4c4552", execute_after: 1, execute_before: 1_900_000_000 },
      nonce,
      calls,
      "2",
    );

  it("is made from the player's passkey at the Ready 0.5 address and written as the payout wallet", async () => {
    notices.mockClear();
    const { browser, passkey, wallet } = await withWallet();
    const { user } = (await browser.session())!;
    const expected = defaultWalletDeployment(
      { origin: ORIGIN, rpId: new URL(ORIGIN).hostname, publicKeyX: passkey.x },
      await env.GUARDIAN.publicKey(),
      user.realmsId,
    );
    expect(wallet.address).toBe(expected.address);
    expect(user.address).toBe(expected.address);
    expect(notices).toHaveBeenCalledWith(user.email, expected.address, expect.any(String), "payout");
    const history = await env.DB.prepare(
      "SELECT wallet FROM wallet_link_history WHERE account = ? AND replaced_at IS NULL",
    )
      .bind(user.realmsId)
      .first<{ wallet: string }>();
    expect(history?.wallet).toBe(expected.address);
    const read = (await (await browser.request("/api/auth/wallet/default")).json()) as { wallet: unknown };
    expect(read.wallet).toEqual({
      address: expected.address,
      credentialId: passkey.credentialId,
      publicKeyX: passkey.x,
      origin: ORIGIN,
      rpId: new URL(ORIGIN).hostname,
    });
  });

  it("answers a retry, even with another passkey, with the first wallet", async () => {
    const { browser, wallet } = await withWallet();
    const again = makePasskey();
    const retried = await create(browser, {
      passkey: { credentialId: again.credentialId, publicKey: again.publicKey },
    });
    expect(((await retried.json()) as { wallet: { address: string } }).wallet.address).toBe(wallet.address);
  });

  /** Ages the browser's session past the minutes a sign-in vouches for a first wallet. */
  const ageSignIn = async (browser: ReturnType<typeof createBrowser>) => {
    const { user } = (await browser.session())!;
    await env.DB.prepare(`UPDATE session SET "createdAt" = ? WHERE "userId" = ?`)
      .bind(new Date(Date.now() - 11 * 60 * 1000).toISOString(), user.id)
      .run();
  };
  const passkeyBody = (passkey: ReturnType<typeof makePasskey>) => ({
    credentialId: passkey.credentialId,
    publicKey: passkey.publicKey,
  });

  it("takes an emailed code once the sign-in is more than minutes old, as any wallet change does", async () => {
    const browser = await newPlayer();
    await ageSignIn(browser);
    const passkey = makePasskey();
    const stale = await create(browser, { passkey: passkeyBody(passkey) });
    expect(stale.status).toBe(403);
    expect(((await stale.json()) as { message: string }).message).toBe("CODE_REQUIRED");
    expect((await browser.session())!.user.address ?? null).toBeNull();
    const linked = await create(browser, { passkey: passkeyBody(passkey), otp: await walletCode(browser) });
    expect(linked.status).toBe(200);
    const { wallet } = (await linked.json()) as { wallet: { address: string; publicKeyX: string } };
    expect(wallet.publicKeyX).toBe(passkey.x);
    expect((await browser.session())!.user.address).toBe(wallet.address);
  });

  it("keeps nothing of a passkey refused for want of a code, so a stolen session cannot plant one", async () => {
    const browser = await newPlayer();
    await ageSignIn(browser);
    // Someone holding the session cookie, but not the inbox, offers their own passkey.
    const planted = await create(browser, { passkey: passkeyBody(makePasskey()) });
    expect(planted.status).toBe(403);
    expect(
      ((await (await browser.request("/api/auth/wallet/default")).json()) as { wallet: unknown }).wallet,
    ).toBeNull();
    // The owner, with the code, makes the wallet from their own passkey.
    const owner = makePasskey();
    const made = await create(browser, { passkey: passkeyBody(owner), otp: await walletCode(browser) });
    expect(((await made.json()) as { wallet: { publicKeyX: string } }).wallet.publicKeyX).toBe(owner.x);
  });

  it("never replaces a linked wallet without a code", async () => {
    const browser = createBrowser();
    await signInWithCode(browser, `linked-${crypto.randomUUID()}@realms.test`);
    const linked = createWallet();
    expect((await proveWallet(browser, linked, "link")).status).toBe(200);
    const passkey = makePasskey();
    const refused = await create(browser, {
      passkey: { credentialId: passkey.credentialId, publicKey: passkey.publicKey },
    });
    expect(refused.status).toBe(400);
    expect(((await refused.json()) as { message: string }).message).toBe("WALLET_ALREADY_LINKED");
    expect(BigInt((await browser.session())!.user.address!)).toBe(BigInt(linked));
  });

  it("refuses a public key that is not P-256", async () => {
    const browser = await newPlayer();
    const refused = await create(browser, { passkey: { credentialId: "abc", publicKey: "AAAA" } });
    expect(((await refused.json()) as { message: string }).message).toBe("PASSKEY_INVALID");
  });

  it("builds a send paid by the wallet in LORDS, deploying the wallet with its first, and answers its fee", async () => {
    const { browser, passkey, wallet } = await withWallet();
    const { user } = (await browser.session())!;
    const fee = { estimated: "0x6d5e1a3a2b8c0000", max: "0x7e4a18b6f2a40000" };
    paymaster.build.mockResolvedValueOnce(built(executionFor(), fee));
    const first = await browser.request("/api/auth/wallet/default/build", { body: { calls: [transfer] } });
    expect(await first.json()).toEqual({ typedData: JSON.parse(JSON.stringify(executionFor())), fee });
    expect(paymaster.build).toHaveBeenLastCalledWith(
      wallet.address,
      [transfer],
      defaultWalletDeployment(
        { origin: ORIGIN, rpId: new URL(ORIGIN).hostname, publicKeyX: passkey.x },
        await env.GUARDIAN.publicKey(),
        user.realmsId,
      ),
      "wallet",
    );
    isDeployed.mockResolvedValueOnce(true);
    paymaster.build.mockResolvedValueOnce(built(executionFor(), fee));
    await browser.request("/api/auth/wallet/default/build", { body: { calls: [transfer] } });
    expect(paymaster.build).toHaveBeenLastCalledWith(wallet.address, [transfer], null, "wallet");
    paymaster.build.mockReset();
  });

  it("answers a build the paymaster refuses (too little LORDS for its fee) as proven not sent", async () => {
    const { browser } = await withWallet();
    paymaster.build.mockRejectedValueOnce(new PaymasterRefusedError("u256_sub Overflow"));
    const refused = await browser.request("/api/auth/wallet/default/build", { body: { calls: [transfer] } });
    expect(refused.status).toBe(502);
    expect(((await refused.json()) as { message: string }).message).toBe("PAYMASTER_REFUSED");
    paymaster.build.mockReset();
  });

  it("refuses to build a call to the wallet itself", async () => {
    const { browser, wallet } = await withWallet();
    const selfCall = { contractAddress: wallet.address, entrypoint: "trigger_escape_guardian", calldata: ["0x1"] };
    const refused = await browser.request("/api/auth/wallet/default/build", { body: { calls: [selfCall] } });
    expect(((await refused.json()) as { message: string }).message).toBe("WALLET_SELF_CALL");
    expect(paymaster.build).not.toHaveBeenCalled();
  });

  it("submits the passkey's signature with the guardian's over the execution's hash, the wallet paying, with no daily cap", async () => {
    const { browser, wallet } = await withWallet();
    const execution = executionFor();
    const ownerSignature = ["0x4", "0x1", "0x2"];
    paymaster.execute.mockResolvedValue("0xabc");
    const sent = await browser.request("/api/auth/wallet/default/execute", {
      body: { typedData: execution, ownerSignature },
    });
    expect(await sent.json()).toEqual({ transactionHash: "0xabc" });
    const [address, submitted, signature, , payer] = paymaster.execute.mock.lastCall!;
    expect(address).toBe(wallet.address);
    expect(submitted).toEqual(execution);
    expect(payer).toBe("wallet");
    const guardian = await env.GUARDIAN.publicKey();
    expect(signature.slice(0, 6).map(BigInt)).toEqual([2n, 4n, 1n, 2n, 0n, BigInt(guardian)]);
    const digest = typedData.getMessageHash(execution, wallet.address);
    const [r, s] = signature.slice(6).map(BigInt);
    expect(
      ec.starkCurve.verify(new ec.starkCurve.Signature(r!, s!), digest, ec.starkCurve.getPublicKey(GUARDIAN_KEY)),
    ).toBe(true);
    // The wallet pays its own fees, so nothing caps how often it sends.
    for (let call = 1; call <= 4; call += 1) {
      const next = await browser.request("/api/auth/wallet/default/execute", {
        body: { typedData: executionFor([transfer], `0x${(0x100 + call).toString(16)}`), ownerSignature },
      });
      expect(next.status).toBe(200);
    }
    expect(paymaster.execute).toHaveBeenCalledTimes(5);
    paymaster.execute.mockReset();
  });

  it("answers a send the paymaster refuses as proven never sent", async () => {
    const { browser } = await withWallet();
    paymaster.execute.mockRejectedValueOnce(new PaymasterRefusedError("invalid signature"));
    const refused = await browser.request("/api/auth/wallet/default/execute", {
      body: { typedData: executionFor(), ownerSignature: ["0x4"] },
    });
    expect(refused.status).toBe(502);
    expect(((await refused.json()) as { message: string }).message).toBe("PAYMASTER_REFUSED");
    paymaster.execute.mockReset();
  });

  it("answers a lost paymaster answer as uncertain, and resubmits the same signed execution", async () => {
    const { browser } = await withWallet();
    const execution = executionFor([transfer], "0x77");
    // The paymaster accepted the execution, then its answer was lost.
    paymaster.execute.mockRejectedValueOnce(new TypeError("fetch failed"));
    const lost = await browser.request("/api/auth/wallet/default/execute", {
      body: { typedData: execution, ownerSignature: ["0x4"] },
    });
    expect(lost.status).toBe(503);
    expect(((await lost.json()) as { message: string }).message).toBe("SEND_UNCERTAIN");
    // The browser sends the same signed execution again: the same nonce, so it can run once.
    paymaster.execute.mockResolvedValueOnce("0xsame");
    const again = await browser.request("/api/auth/wallet/default/execute", {
      body: { typedData: execution, ownerSignature: ["0x4"] },
    });
    expect(await again.json()).toEqual({ transactionHash: "0xsame" });
    expect(paymaster.execute.mock.calls.map(([, submitted]) => submitted)).toEqual([execution, execution]);
    paymaster.execute.mockReset();
  });

  it("without the sponsor key still sends (the wallet pays), and refuses a cancel and a recovery before anything is spent", async () => {
    const { browser, wallet } = await withWallet();
    paymaster.canSponsor = false;
    try {
      paymaster.build.mockResolvedValueOnce(built(executionFor(), { estimated: "0x1", max: "0x2" }));
      expect((await browser.request("/api/auth/wallet/default/build", { body: { calls: [transfer] } })).status).toBe(
        200,
      );
      paymaster.execute.mockResolvedValueOnce("0xpaid");
      const sent = await browser.request("/api/auth/wallet/default/execute", {
        body: { typedData: executionFor(), ownerSignature: ["0x4"] },
      });
      expect(await sent.json()).toEqual({ transactionHash: "0xpaid" });
      const cancel = { contractAddress: wallet.address, entrypoint: "cancel_escape", calldata: [] };
      const cancelBuild = await browser.request("/api/auth/wallet/default/build", { body: { calls: [cancel] } });
      expect(cancelBuild.status).toBe(503);
      expect(((await cancelBuild.json()) as { message: string }).message).toBe("SPONSOR_UNAVAILABLE");
      const cancelSend = await browser.request("/api/auth/wallet/default/execute", {
        body: { typedData: executionFor([cancel]), ownerSignature: ["0x4"] },
      });
      expect(((await cancelSend.json()) as { message: string }).message).toBe("SPONSOR_UNAVAILABLE");
      const lost = makePasskey();
      const recovery = await browser.request("/api/auth/wallet/default/recovery", {
        body: { passkey: passkeyBody(lost), otp: await walletCode(browser) },
      });
      expect(recovery.status).toBe(503);
      expect(((await recovery.json()) as { message: string }).message).toBe("SPONSOR_UNAVAILABLE");
      expect(paymaster.build).toHaveBeenCalledTimes(1);
      expect(paymaster.execute).toHaveBeenCalledTimes(1);
    } finally {
      paymaster.canSponsor = true;
      paymaster.build.mockReset();
      paymaster.execute.mockReset();
    }
  });

  it("co-signs only an outside execution for this chain", async () => {
    const { browser } = await withWallet();
    const other = { ...executionFor(), domain: { ...executionFor().domain, chainId: "0x534e5f5345504f4c4941" } };
    const refused = await browser.request("/api/auth/wallet/default/execute", {
      body: { typedData: other, ownerSignature: ["0x4"] },
    });
    expect(((await refused.json()) as { message: string }).message).toBe("NOT_AN_OUTSIDE_EXECUTION");
  });

  describe("recovery", () => {
    const rpId = new URL(ORIGIN).hostname;
    const recover = async (
      browser: ReturnType<typeof createBrowser>,
      passkey: ReturnType<typeof makePasskey>,
      otp: string,
    ) => browser.request("/api/auth/wallet/default/recovery", { body: { passkey: passkeyBody(passkey), otp } });
    const recoveryRow = (realmsId: string) =>
      env.DB.prepare("SELECT attempt, credential_id, public_key_x, nonce FROM wallet_recoveries WHERE realms_id = ?")
        .bind(realmsId)
        .first<{ attempt: string; credential_id: string; public_key_x: string; nonce: string | null }>();
    const walletRow = (realmsId: string) =>
      env.DB.prepare("SELECT credential_id, public_key_x, deploy_key_x FROM default_wallets WHERE realms_id = ?")
        .bind(realmsId)
        .first<{ credential_id: string; public_key_x: string; deploy_key_x: string }>();
    const recoveryNotices = (address: string) =>
      env.DB.prepare("SELECT id FROM wallet_change_notices WHERE kind = 'recovery' AND address = ?")
        .bind(address)
        .all<{ id: string }>();
    /** The escape's start as the player asked it: trigger_escape_owner naming the passkey just made. */
    const escapeStart = (wallet: string, passkey: ReturnType<typeof makePasskey>) => ({
      contractAddress: wallet,
      entrypoint: "trigger_escape_owner",
      calldata: passkeySigner({ origin: ORIGIN, rpId, publicKeyX: passkey.x }),
    });
    const escapeFinish = (wallet: string) => ({ contractAddress: wallet, entrypoint: "escape_owner", calldata: [] });
    const guidOf = (passkey: ReturnType<typeof makePasskey>) =>
      passkeySignerGuid({ origin: ORIGIN, rpId, publicKeyX: passkey.x });
    const resetPaymaster = () => {
      paymaster.build.mockReset();
      paymaster.execute.mockReset();
      notices.mockClear();
    };
    /** A wallet with a recovery started naming `lost`, its execution recorded; the paymaster's answer as `execute` says. */
    const startedRecovery = async (execute: () => Promise<string> = async () => "0xescape") => {
      const { browser, passkey, wallet } = await withWallet();
      const { user } = (await browser.session())!;
      const lost = makePasskey();
      paymaster.build.mockResolvedValueOnce(built(executionFor([escapeStart(wallet.address, lost)], "0xe5")));
      paymaster.execute.mockImplementationOnce(execute);
      const answer = await recover(browser, lost, await walletCode(browser));
      return { browser, realmsId: user.realmsId, passkey, lost, wallet, answer };
    };

    it("starts with the emailed code: the guardian alone signs the exact escape naming the new passkey, and the email is told", async () => {
      resetPaymaster();
      const { browser, passkey, wallet } = await withWallet();
      const { user } = (await browser.session())!;
      const lost = makePasskey();
      const start = executionFor([escapeStart(wallet.address, lost)], "0xe1");
      paymaster.build.mockResolvedValueOnce(built(start));
      paymaster.execute.mockResolvedValueOnce("0xescape");
      expect((await recover(browser, lost, "000000")).status).toBe(400);
      expect(paymaster.execute).not.toHaveBeenCalled();
      const started = await recover(browser, lost, await walletCode(browser));
      expect(await started.json()).toEqual({ transactionHash: "0xescape" });
      expect(paymaster.build.mock.lastCall![1]).toEqual([escapeStart(wallet.address, lost)]);
      // A recovery step is the wallet's single call, with no fee call after it: sponsored.
      expect(paymaster.build.mock.lastCall![3]).toBe("sponsor");
      expect(paymaster.execute.mock.lastCall![4]).toBe("sponsor");
      const [, , signature] = paymaster.execute.mock.lastCall!;
      expect(signature).toHaveLength(2);
      const digest = typedData.getMessageHash(start, wallet.address);
      expect(
        ec.starkCurve.verify(
          new ec.starkCurve.Signature(BigInt(signature[0]!), BigInt(signature[1]!)),
          digest,
          ec.starkCurve.getPublicKey(GUARDIAN_KEY),
        ),
      ).toBe(true);
      expect(await recoveryRow(user.realmsId)).toMatchObject({
        credential_id: lost.credentialId,
        public_key_x: lost.x,
        nonce: "0xe1",
      });
      expect(notices).toHaveBeenCalledWith(user.email, wallet.address, expect.any(String), "recovery");
      // The wallet keeps its owner until the 7 days are up.
      expect((await walletRow(user.realmsId))?.public_key_x).toBe(passkey.x);
      resetPaymaster();
    });

    it("signs nothing a paymaster substitutes: another new owner, target, entrypoint, or an extra call", async () => {
      const { browser, wallet } = await withWallet();
      const { user } = (await browser.session())!;
      const asked = makePasskey();
      const asWanted = escapeStart(wallet.address, asked);
      const substitutes = [
        [escapeStart(wallet.address, makePasskey())],
        [{ ...asWanted, contractAddress: "0x1234" }],
        [{ ...asWanted, entrypoint: "trigger_escape_guardian" }],
        [asWanted, transfer],
      ];
      for (const calls of substitutes) {
        resetPaymaster();
        paymaster.build.mockResolvedValueOnce(built(executionFor(calls)));
        const refused = await recover(browser, asked, await walletCode(browser));
        expect(((await refused.json()) as { message: string }).message).toBe("PAYMASTER_REFUSED");
        expect(paymaster.execute).not.toHaveBeenCalled();
        expect(await recoveryRow(user.realmsId)).toBeNull();
        expect((await recoveryNotices(wallet.address)).results).toEqual([]);
      }
      resetPaymaster();
    });

    it("refuses a second start while the first is unsettled, even before the chain shows it, and keeps the first", async () => {
      resetPaymaster();
      // The first start's answer is lost: its escape may land later.
      const first = await startedRecovery(async () => {
        throw new TypeError("fetch failed");
      });
      expect(((await first.answer.json()) as { message: string }).message).toBe("SEND_UNCERTAIN");
      const kept = await recoveryRow(first.realmsId);
      expect(kept).toMatchObject({ credential_id: first.lost.credentialId, nonce: "0xe5" });
      paymaster.build.mockResolvedValueOnce(built(executionFor([escapeStart(first.wallet.address, makePasskey())])));
      const second = await recover(first.browser, makePasskey(), await walletCode(first.browser));
      expect(((await second.json()) as { message: string }).message).toBe("RECOVERY_UNDER_WAY");
      expect(await recoveryRow(first.realmsId)).toEqual(kept);
      resetPaymaster();
    });

    it("keeps the warning email of a start whose answer was lost, deliverable once", async () => {
      resetPaymaster();
      const lost = await startedRecovery(async () => {
        throw new TypeError("connection reset");
      });
      const queued = (await recoveryNotices(lost.wallet.address)).results;
      expect(queued).toHaveLength(1);
      const sent = vi.fn<SendWalletNotice>(async () => {});
      await Effect.runPromise(deliverWalletNotices(env.DB, sent));
      await Effect.runPromise(deliverWalletNotices(env.DB, sent));
      expect(
        sent.mock.calls.filter(([, address, , kind]) => address === lost.wallet.address && kind === "recovery"),
      ).toEqual([[expect.any(String), lost.wallet.address, queued[0]!.id, "recovery"]]);
      resetPaymaster();
    });

    it("never lets the send path start an escape, and lets the owner's passkey cancel one", async () => {
      resetPaymaster();
      const { browser, wallet } = await withWallet();
      const start = { contractAddress: wallet.address, entrypoint: "trigger_escape_owner", calldata: ["0x1"] };
      const startBuild = await browser.request("/api/auth/wallet/default/build", { body: { calls: [start] } });
      expect(((await startBuild.json()) as { message: string }).message).toBe("WALLET_SELF_CALL");
      const startExecute = await browser.request("/api/auth/wallet/default/execute", {
        body: { typedData: executionFor([start]), ownerSignature: ["0x4"] },
      });
      expect(((await startExecute.json()) as { message: string }).message).toBe("WALLET_SELF_CALL");
      const cancel = { contractAddress: wallet.address, entrypoint: "cancel_escape", calldata: [] };
      paymaster.build.mockResolvedValueOnce(built(executionFor([cancel])));
      expect((await browser.request("/api/auth/wallet/default/build", { body: { calls: [cancel] } })).status).toBe(200);
      // The wallet takes a cancel only as its single call, so it carries no fee call: sponsored.
      expect(paymaster.build.mock.lastCall![3]).toBe("sponsor");
      paymaster.execute.mockResolvedValueOnce("0xcancel");
      const canceled = await browser.request("/api/auth/wallet/default/execute", {
        body: { typedData: executionFor([cancel]), ownerSignature: ["0x4"] },
      });
      expect(await canceled.json()).toEqual({ transactionHash: "0xcancel" });
      // The cancel carries the owner's signature and the guardian's: two signers.
      expect(BigInt(paymaster.execute.mock.lastCall![2][0]!)).toBe(2n);
      expect(paymaster.execute.mock.lastCall![4]).toBe("sponsor");
      resetPaymaster();
    });

    /** The cron's pass, the chain answering as `chain` says. */
    const finishWith = (
      wallet: string,
      chain: {
        escape: WalletEscape;
        owner: boolean;
        succeeded?: boolean;
        nonceSpent?: boolean;
        chainTime?: number;
      },
    ) => {
      paymaster.build.mockResolvedValue(built(executionFor([escapeFinish(wallet)], "0xf1")));
      paymaster.execute.mockResolvedValue("0xfinish");
      return finishRecoveries({
        db: env.DB,
        paymaster,
        guardian: env.GUARDIAN,
        chainId: encodeChainName(environmentL2(env.ENVIRONMENT).chain),
        isDeployed: async () => true,
        readEscape: async () => chain.escape,
        readAttemptState: async () => ({
          escape: chain.escape,
          newOwnerOwns: chain.owner,
          nonceSpent: chain.nonceSpent ?? false,
          time: chain.chainTime ?? 1_000,
        }),
        succeeded: async () => chain.succeeded ?? true,
      });
    };

    /** The sponsored recovery steps an account has taken today. */
    const sponsoredSteps = async (realmsId: string) =>
      (
        await env.DB.prepare("SELECT COUNT(*) AS steps FROM sponsored_executions WHERE realms_id = ? AND day = ?")
          .bind(realmsId, new Date().toISOString().slice(0, 10))
          .first<{ steps: number }>()
      )?.steps;
    /** The next UTC day for this account: today's steps become yesterday's. */
    const nextDay = (realmsId: string) =>
      env.DB.prepare("UPDATE sponsored_executions SET day = '2000-01-01' WHERE realms_id = ?").bind(realmsId).run();
    const none = { status: "none", readyAt: null, newOwner: null } as const;
    const cancelOf = (wallet: string) => ({ contractAddress: wallet, entrypoint: "cancel_escape", calldata: [] });
    /** The owner's passkey cancels the standing escape through the send path, its paymaster answering `execute`. */
    const cancelEscape = async (
      browser: ReturnType<typeof createBrowser>,
      wallet: string,
      nonce: string,
      execute: () => Promise<string> = async () => `0xc${nonce.slice(2)}`,
    ) => {
      paymaster.execute.mockImplementationOnce(execute);
      return browser.request("/api/auth/wallet/default/execute", {
        body: { typedData: executionFor([cancelOf(wallet)], nonce), ownerSignature: ["0x4"] },
      });
    };

    it("bounds a start and cancel loop to the account's sponsored steps for the day, across code windows and cron cleanups", async () => {
      resetPaymaster();
      const { browser, wallet } = await withWallet();
      const { user } = (await browser.session())!;
      isDeployed.mockResolvedValue(true);
      try {
        const sponsored = () => paymaster.execute.mock.calls.filter((call) => call[4] === "sponsor").length;
        // The first cycle: a start, its cancel, and the cron forgetting the canceled attempt.
        readEscape.mockResolvedValue(none);
        const first = makePasskey();
        paymaster.build.mockResolvedValueOnce(built(executionFor([escapeStart(wallet.address, first)], "0x101")));
        paymaster.execute.mockResolvedValueOnce("0x201");
        expect((await recover(browser, first, await walletCode(browser))).status).toBe(200);
        expect((await cancelEscape(browser, wallet.address, "0x401")).status).toBe(200);
        await finishWith(wallet.address, { escape: none, owner: false, nonceSpent: true });
        expect(await recoveryRow(user.realmsId)).toBeNull();
        expect(await sponsoredSteps(user.realmsId)).toBe(2);
        // Three more cycles, each in a new code window after the cron's cleanup: every start is refused for the day,
        // before its code is spent or anything is built, signed or sponsored.
        for (const round of [2, 3, 4]) {
          paymaster.build.mockClear();
          const again = makePasskey();
          const refused = await recover(browser, again, await walletCode(browser));
          expect(refused.status).toBe(429);
          expect(((await refused.json()) as { message: string }).message).toBe("SPONSOR_CAP_REACHED");
          expect(paymaster.build).not.toHaveBeenCalled();
          expect(await recoveryRow(user.realmsId)).toBeNull();
          await finishWith(wallet.address, { escape: none, owner: false, nonceSpent: true });
          expect(round).toBeGreaterThan(1);
        }
        expect(sponsored()).toBe(2);
        expect(await sponsoredSteps(user.realmsId)).toBe(2);
        // The next UTC day the account may start again.
        await nextDay(user.realmsId);
        resetPaymaster();
        const later = makePasskey();
        paymaster.build.mockResolvedValueOnce(built(executionFor([escapeStart(wallet.address, later)], "0x105")));
        paymaster.execute.mockResolvedValueOnce("0x205");
        expect((await recover(browser, later, await walletCode(browser))).status).toBe(200);
        expect(await sponsoredSteps(user.realmsId)).toBe(1);
      } finally {
        readEscape.mockResolvedValue(none);
        isDeployed.mockResolvedValue(false);
        resetPaymaster();
      }
    });

    it("keeps a step free for the owner's cancel: a start that would leave none is refused, the cancel goes through", async () => {
      resetPaymaster();
      const { realmsId, wallet, browser } = await startedRecovery();
      // The start took one step; a second sponsored step (an earlier finish, say) leaves one, for the cancel.
      await env.DB.prepare("INSERT INTO sponsored_executions (realms_id, nonce, day) VALUES (?, '0xearlier', ?)")
        .bind(realmsId, new Date().toISOString().slice(0, 10))
        .run();
      // Another start would take the last step and leave the owner no cancel: refused before its code is spent.
      paymaster.build.mockClear();
      const start = await recover(browser, makePasskey(), await walletCode(browser));
      expect(((await start.json()) as { message: string }).message).toBe("SPONSOR_CAP_REACHED");
      expect(paymaster.build).not.toHaveBeenCalled();
      expect((await cancelEscape(browser, wallet.address, "0x4c1")).status).toBe(200);
      expect(await sponsoredSteps(realmsId)).toBe(3);
      // All three spent: another cancel's build and send are refused before any paymaster call.
      paymaster.build.mockClear();
      paymaster.execute.mockClear();
      const build = await browser.request("/api/auth/wallet/default/build", {
        body: { calls: [cancelOf(wallet.address)] },
      });
      expect(build.status).toBe(429);
      const send = await cancelEscape(browser, wallet.address, "0x4c2");
      expect(((await send.json()) as { message: string }).message).toBe("SPONSOR_CAP_REACHED");
      expect(paymaster.build).not.toHaveBeenCalled();
      expect(paymaster.execute).not.toHaveBeenCalled();
      resetPaymaster();
    });

    it("keeps a cancel's step counted whatever the paymaster answers, once per execution", async () => {
      resetPaymaster();
      const { browser, wallet, user } = await withWallet().then(async (made) => ({
        ...made,
        user: (await made.browser.session())!.user,
      }));
      const refused = await cancelEscape(browser, wallet.address, "0x4d1", async () => {
        throw new PaymasterRefusedError("argent/invalid-escape");
      });
      expect(((await refused.json()) as { message: string }).message).toBe("PAYMASTER_REFUSED");
      expect(await sponsoredSteps(user.realmsId)).toBe(1);
      const lost = await cancelEscape(browser, wallet.address, "0x4d2", async () => {
        throw new TypeError("fetch failed");
      });
      expect(((await lost.json()) as { message: string }).message).toBe("SEND_UNCERTAIN");
      expect(await sponsoredSteps(user.realmsId)).toBe(2);
      // The same signed cancel again counts no other step, and its refusal gives none back.
      const resubmitted = await cancelEscape(browser, wallet.address, "0x4d2", async () => {
        throw new PaymasterRefusedError("duplicated outside nonce");
      });
      expect(resubmitted.status).toBe(502);
      expect(await sponsoredSteps(user.realmsId)).toBe(2);
      resetPaymaster();
    });

    it("keeps a cancel counted when its first request is refused after a duplicate of it landed, so no fourth step is accepted", async () => {
      resetPaymaster();
      const { browser, wallet, realmsId } = await startedRecovery();
      // The first request reaches the paymaster and waits; a duplicate of the same signed cancel lands meanwhile; then
      // the first is refused (the duplicate spent its nonce).
      let arrived!: () => void;
      const atPaymaster = new Promise<void>((resolve) => (arrived = resolve));
      let refuse!: () => void;
      const refusal = new Promise<void>((resolve) => (refuse = resolve));
      const first = cancelEscape(browser, wallet.address, "0xc001", async () => {
        arrived();
        await refusal;
        throw new PaymasterRefusedError("outside nonce already spent");
      });
      await atPaymaster;
      const duplicate = await cancelEscape(browser, wallet.address, "0xc001", async () => "0xaccepted");
      expect(duplicate.status).toBe(200);
      refuse();
      expect((await first).status).toBe(502);
      // The start and the landed cancel both stay counted.
      expect(await sponsoredSteps(realmsId)).toBe(2);
      await finishWith(wallet.address, { escape: none, owner: false, nonceSpent: true });
      expect(await recoveryRow(realmsId)).toBeNull();
      // A new start needs room for its cancel: refused.
      paymaster.build.mockClear();
      const again = await recover(browser, makePasskey(), await walletCode(browser));
      expect(((await again.json()) as { message: string }).message).toBe("SPONSOR_CAP_REACHED");
      expect(paymaster.build).not.toHaveBeenCalled();
      // A third step may still go (another cancel); a fourth is refused before the paymaster.
      expect((await cancelEscape(browser, wallet.address, "0xc002")).status).toBe(200);
      paymaster.execute.mockClear();
      const fourth = await cancelEscape(browser, wallet.address, "0xc003");
      expect(((await fourth.json()) as { message: string }).message).toBe("SPONSOR_CAP_REACHED");
      expect(paymaster.execute).not.toHaveBeenCalled();
      expect(await sponsoredSteps(realmsId)).toBe(3);
      resetPaymaster();
    });

    it("counts no wallet-paid send: after many sends the account still has its sponsored steps", async () => {
      resetPaymaster();
      const { browser, user } = await withWallet().then(async (made) => ({
        ...made,
        user: (await made.browser.session())!.user,
      }));
      paymaster.execute.mockResolvedValue("0xpaid");
      for (let send = 0; send < 5; send += 1) {
        const sent = await browser.request("/api/auth/wallet/default/execute", {
          body: { typedData: executionFor([transfer], `0x${(0x500 + send).toString(16)}`), ownerSignature: ["0x4"] },
        });
        expect(sent.status).toBe(200);
      }
      expect(await sponsoredSteps(user.realmsId)).toBe(0);
      resetPaymaster();
    });

    it("holds a ready escape's finish while today's steps are spent, and finishes it the next day", async () => {
      resetPaymaster();
      const { realmsId, lost, wallet } = await startedRecovery();
      const day = new Date().toISOString().slice(0, 10);
      await env.DB.batch(
        ["0xa1", "0xa2"].map((nonce) =>
          env.DB.prepare("INSERT INTO sponsored_executions (realms_id, nonce, day) VALUES (?, ?, ?)").bind(
            realmsId,
            nonce,
            day,
          ),
        ),
      );
      resetPaymaster();
      vi.spyOn(console, "error").mockImplementation(() => {});
      const ready = { escape: { status: "ready" as const, readyAt: 1, newOwner: guidOf(lost) }, owner: true };
      await finishWith(wallet.address, ready);
      expect(paymaster.execute).not.toHaveBeenCalled();
      expect(await recoveryRow(realmsId)).not.toBeNull();
      await nextDay(realmsId);
      await finishWith(wallet.address, ready);
      expect(paymaster.execute.mock.lastCall![4]).toBe("sponsor");
      expect(await recoveryRow(realmsId)).toBeNull();
      expect(await sponsoredSteps(realmsId)).toBe(1);
      vi.mocked(console.error).mockRestore();
      resetPaymaster();
    });

    it("finishes a ready escape naming the saved passkey and hands the wallet to it, keeping its address", async () => {
      resetPaymaster();
      const { realmsId, passkey, lost, wallet } = await startedRecovery();
      resetPaymaster();
      await finishWith(wallet.address, {
        escape: { status: "ready", readyAt: 1, newOwner: guidOf(lost) },
        owner: true,
      });
      expect(paymaster.build.mock.lastCall).toEqual([wallet.address, [escapeFinish(wallet.address)], null, "sponsor"]);
      expect(await walletRow(realmsId)).toEqual({
        credential_id: lost.credentialId,
        public_key_x: lost.x,
        deploy_key_x: passkey.x,
      });
      expect(await recoveryRow(realmsId)).toBeNull();
      resetPaymaster();
    });

    it("never finishes an escape that names another owner", async () => {
      resetPaymaster();
      const { realmsId, passkey, wallet } = await startedRecovery();
      resetPaymaster();
      await finishWith(wallet.address, {
        escape: { status: "ready", readyAt: 1, newOwner: guidOf(makePasskey()) },
        owner: false,
      });
      expect(paymaster.build).not.toHaveBeenCalled();
      expect(paymaster.execute).not.toHaveBeenCalled();
      expect((await walletRow(realmsId))?.public_key_x).toBe(passkey.x);
      expect(await recoveryRow(realmsId)).not.toBeNull();
      resetPaymaster();
    });

    it("forgets an attempt only once the chain proves it over, and adopts a finish cut short", async () => {
      resetPaymaster();
      const none = { status: "none" as const, readyAt: null, newOwner: null };
      const delayed = await startedRecovery();
      // Not on chain yet, its nonce unspent and its window open: it may still land.
      await finishWith(delayed.wallet.address, { escape: none, owner: false, nonceSpent: false, chainTime: 1_000 });
      expect(await recoveryRow(delayed.realmsId)).not.toBeNull();
      // Its window closed with the nonce unspent: it never can run.
      await finishWith(delayed.wallet.address, {
        escape: none,
        owner: false,
        nonceSpent: false,
        chainTime: 1_900_000_000,
      });
      expect(await recoveryRow(delayed.realmsId)).toBeNull();
      const canceled = await startedRecovery();
      // It ran (nonce spent) and no escape stands: canceled.
      await finishWith(canceled.wallet.address, { escape: none, owner: false, nonceSpent: true });
      expect(await recoveryRow(canceled.realmsId)).toBeNull();
      expect((await walletRow(canceled.realmsId))?.public_key_x).toBe(canceled.passkey.x);
      const cutShort = await startedRecovery();
      await finishWith(cutShort.wallet.address, { escape: none, owner: true });
      expect((await walletRow(cutShort.realmsId))?.public_key_x).toBe(cutShort.lost.x);
      const unconfirmed = await startedRecovery();
      await finishWith(unconfirmed.wallet.address, {
        escape: { status: "ready", readyAt: 1, newOwner: guidOf(unconfirmed.lost) },
        owner: false,
        succeeded: false,
      });
      expect(await recoveryRow(unconfirmed.realmsId)).not.toBeNull();
      resetPaymaster();
    });

    /**
     * A chain that answers per block: at block 100 no escape and the nonce unspent; from block 101 the start has landed
     * (escape waiting, nonce spent). It moves to block 101 after the first read, as a real chain may between reads.
     */
    const advancingChain = (passkey: ReturnType<typeof makePasskey>) => {
      let head = 100;
      const blocks: unknown[] = [];
      const landed = ["0x6a000000", "0x2", "0x0", guidOf(passkey), "0x4", "0x1"];
      const before = ["0x0", "0x0", "0x1", "0x0"];
      return {
        blocks,
        provider: {
          getBlockWithTxHashes: async () => ({ block_number: head, timestamp: 1_000 }),
          callContract: async ({ entrypoint }: { entrypoint: string }, block: unknown) => {
            blocks.push(block);
            const at = typeof block === "number" ? block : ++head;
            head = 101;
            if (entrypoint === "get_escape_and_status") return at >= 101 ? landed : before;
            if (entrypoint === "is_owner") return ["0x0"];
            return [at >= 101 ? "0x0" : "0x1"];
          },
        } as unknown as ProviderInterface,
      };
    };

    it("reads an attempt's escape, ownership and nonce at one block, so a start landing mid-read is never a cancel", async () => {
      const lost = makePasskey();
      const chain = advancingChain(lost);
      const state = await readAttemptState(
        chain.provider,
        "0x123",
        { origin: ORIGIN, rpId, publicKeyX: lost.x },
        "0xe5",
      );
      // Block 100 throughout: no escape and the nonce unspent, never "no escape, nonce spent".
      expect(state).toEqual({
        escape: { status: "none", readyAt: null, newOwner: null },
        newOwnerOwns: false,
        nonceSpent: false,
        time: 1_000,
      });
      expect(chain.blocks).toEqual([100, 100, 100]);
    });

    it("reads a never-deployed wallet as having nothing, and a genuine read failure as a failure", async () => {
      const notFound = new RpcError({ code: 20, message: "Contract not found" } as never, "starknet_call", {});
      const absent = {
        getBlockWithTxHashes: async () => ({ block_number: 7, timestamp: 2_000 }),
        callContract: async () => {
          throw notFound;
        },
      } as unknown as ProviderInterface;
      const owner = { origin: ORIGIN, rpId, publicKeyX: "0x1" };
      expect(await readAttemptState(absent, "0x123", owner, "0x1")).toEqual({
        escape: { status: "none", readyAt: null, newOwner: null },
        newOwnerOwns: false,
        nonceSpent: false,
        time: 2_000,
      });
      const down = {
        ...absent,
        callContract: async () => Promise.reject(new TypeError("fetch failed")),
      } as unknown as ProviderInterface;
      await expect(readAttemptState(down, "0x123", owner, "0x1")).rejects.toThrow("fetch failed");
    });

    it("forgets an undeployed wallet's lost start once its window closed, and lets a new one start", async () => {
      resetPaymaster();
      const lostStart = await startedRecovery(async () => {
        throw new TypeError("fetch failed");
      });
      const none = { status: "none" as const, readyAt: null, newOwner: null };
      // The wallet was never deployed: nothing on chain, and the block is past the start's window.
      await finishWith(lostStart.wallet.address, {
        escape: none,
        owner: false,
        nonceSpent: false,
        chainTime: 1_900_000_000,
      });
      expect(await recoveryRow(lostStart.realmsId)).toBeNull();
      const next = makePasskey();
      paymaster.build.mockResolvedValueOnce(built(executionFor([escapeStart(lostStart.wallet.address, next)], "0xe6")));
      paymaster.execute.mockResolvedValueOnce("0xagain");
      const again = await recover(lostStart.browser, next, await walletCode(lostStart.browser));
      expect(await again.json()).toEqual({ transactionHash: "0xagain" });
      resetPaymaster();
    });

    it("keeps a start made after an older expired escape until its own nonce or window settles it", async () => {
      resetPaymaster();
      const expired = { status: "expired" as const, readyAt: 1, newOwner: "0xold" };
      // An older escape expired; this start's answer was lost, so it may still land.
      readEscape.mockResolvedValueOnce(expired);
      const later = await startedRecovery(async () => {
        throw new TypeError("fetch failed");
      });
      expect(((await later.answer.json()) as { message: string }).message).toBe("SEND_UNCERTAIN");
      await finishWith(later.wallet.address, { escape: expired, owner: false, nonceSpent: false, chainTime: 1_000 });
      expect(await recoveryRow(later.realmsId)).not.toBeNull();
      // Its window closed with its nonce unspent: it never can run.
      await finishWith(later.wallet.address, {
        escape: expired,
        owner: false,
        nonceSpent: false,
        chainTime: 1_900_000_000,
      });
      expect(await recoveryRow(later.realmsId)).toBeNull();
      resetPaymaster();
    });

    it("forgets the passkey and its email when the paymaster refuses the start", async () => {
      resetPaymaster();
      const refused = await startedRecovery(async () => {
        throw new PaymasterRefusedError("refused");
      });
      expect(((await refused.answer.json()) as { message: string }).message).toBe("PAYMASTER_REFUSED");
      expect(await recoveryRow(refused.realmsId)).toBeNull();
      expect((await recoveryNotices(refused.wallet.address)).results).toEqual([]);
      resetPaymaster();
    });
  });

  it("counts, for the operator, the accounts still without a payout wallet", async () => {
    await newPlayer();
    const counts = (await (
      await createBrowser().request("/api/operator/wallets", { token: OPERATOR_TOKEN })
    ).json()) as { accounts: number; withoutWallet: number; paidToDefaultWallet: number; paidToLinkedWallet: number };
    const expected = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM "user" WHERE "emailVerified" = 1 AND address IS NULL`,
    ).first<{ n: number }>();
    expect(counts.withoutWallet).toBe(expected!.n);
    expect(counts.withoutWallet).toBeGreaterThan(0);
    expect(counts.paidToDefaultWallet).toBeGreaterThan(0);
    expect(counts.accounts).toBe(counts.withoutWallet + counts.paidToDefaultWallet + counts.paidToLinkedWallet);
    expect((await createBrowser().request("/api/operator/wallets")).status).toBe(401);
  });
});

describe("shared links", () => {
  const shard = "https://share-season.test";
  const chainId = "0x5348415245";
  const gameId = 52;
  const raceUrl = `${shard}/games/${gameId}/snapshot?models=RaceMember%2CStructure`;
  const glory = new Map<string, number>();
  const publishRace = () =>
    heralds.set(raceUrl, {
      game_id: String(gameId),
      confirmed_block: 1,
      models: [
        {
          model: "RaceMember",
          rows: [...glory].map(([, points], index) => ({
            key: `${gameId}:${index + 1}`,
            value: { game_id: gameId, entity_id: String(index + 1), glory: String(points * 1e9), contribution: "0" },
          })),
        },
        {
          model: "Structure",
          rows: [...glory].map(([account], index) => ({
            key: `${gameId}:${index + 1}`,
            value: { game_id: gameId, entity_id: String(index + 1), owner: account },
          })),
        },
      ],
    });
  const publishGames = (name = seasonGameName(1_801_000_000)) =>
    heralds.set(`${shard}/games`, {
      chain: chainId,
      games: [{ game_id: gameId, name, mode: "frontier", status: "Live", clock: { end_at: 0 } }],
    });

  beforeAll(async () => {
    await listShard(shard, chainId);
    publishGames();
    publishRace();
  });
  afterAll(async () => {
    await env.DB.prepare("DELETE FROM shards WHERE url = ?").bind(shard).run();
  });

  /** A player signed in on their own browser, which the app opened (so the browser is known for the account). */
  const player = async (name: string, browser = createBrowser()) => {
    await signInWithCode(browser, `${name}@share.test`);
    const { realmsId } = (await browser.session())!.user;
    const account = accountKey(realmsAccountAddress(realmsId, ACCOUNT_CLASS_HASH, await env.GUARDIAN.publicKey()));
    return {
      browser,
      realmsId,
      account,
      share: async (moment: number) => {
        const response = await browser.request("/api/shares", {
          body: { kind: "frontier-day", chainId, gameId, moment },
        });
        expect(response.status).toBe(200);
        return ((await response.json()) as { code: string }).code;
      },
      tally: async () =>
        (await (await browser.request("/api/shares")).json()) as {
          links: number;
          posted: number;
          visits: number;
          joined: number;
          activated: number;
          friendsPaid: number;
          fragmentsEarned: number;
        },
      earn: (points: number) => {
        glory.set(account, points);
        publishRace();
      },
    };
  };
  const visit = async (browser: ReturnType<typeof createBrowser>, code: string) => {
    const response = await browser.request(`/api/shares/${code}/visit`, { method: "POST" });
    return [response.status, await response.json()] as [number, any];
  };

  it("gives a player one link per day, and says who shared it to whoever opens it", async () => {
    const sharer = await player("sharer-one");
    await env.DB.prepare(`UPDATE "user" SET "name" = 'Ashwalker' WHERE "realmsId" = ?`).bind(sharer.realmsId).run();
    const code = await sharer.share(12);
    expect(await sharer.share(12)).toBe(code);
    expect(await sharer.share(13)).not.toBe(code);
    expect(await visit(createBrowser(), code)).toEqual([200, { kind: "frontier-day", moment: 12, name: "Ashwalker" }]);
    expect((await visit(createBrowser(), "NOPE2345"))[0]).toBe(404);
  });

  it("refuses a link for anything but a moment of a game, and for a signed-out browser", async () => {
    const sharer = await player("sharer-refused");
    for (const body of [
      { kind: "season", chainId, gameId, moment: 1 },
      { kind: "frontier-day", chainId: "devnet", gameId, moment: 1 },
      { kind: "frontier-day", chainId, gameId, moment: 0 },
      { kind: "frontier-day", chainId, gameId: 1.5, moment: 1 },
    ])
      expect((await sharer.browser.request("/api/shares", { body })).status).toBe(400);
    const signedOut = createBrowser();
    expect(
      (await signedOut.request("/api/shares", { body: { kind: "frontier-day", chainId, gameId, moment: 1 } })).status,
    ).toBe(401);
  });

  it("counts a friend who opened the link, then joined, then earned 100 Glory", async () => {
    const sharer = await player("sharer-funnel");
    expect(await sharer.tally()).toEqual({
      links: 0,
      posted: 0,
      visits: 0,
      joined: 0,
      activated: 0,
      friendsPaid: 0,
      fragmentsEarned: 0,
    });
    const code = await sharer.share(3);
    expect((await sharer.browser.request(`/api/shares/${code}/posted`, { method: "POST" })).status).toBe(204);

    // The sharer opening their own post is no reach.
    await visit(sharer.browser, code);
    const friendBrowser = createBrowser();
    await visit(friendBrowser, code);
    await visit(friendBrowser, code);
    expect(await sharer.tally()).toEqual({
      links: 1,
      posted: 1,
      visits: 1,
      joined: 0,
      activated: 0,
      friendsPaid: 0,
      fragmentsEarned: 0,
    });

    const friend = await player("friend-funnel", friendBrowser);
    expect(await sharer.tally()).toEqual({
      links: 1,
      posted: 1,
      visits: 1,
      joined: 1,
      activated: 0,
      friendsPaid: 0,
      fragmentsEarned: 0,
    });
    friend.earn(99);
    expect((await sharer.tally()).activated).toBe(0);
    friend.earn(100);
    expect(await sharer.tally()).toEqual({
      links: 1,
      posted: 1,
      visits: 1,
      joined: 1,
      activated: 1,
      friendsPaid: 0,
      fragmentsEarned: 0,
    });
  });

  it("dates a join from the account's making, and counts Glory earned in the link's game however late it is first read", async () => {
    const sharer = await player("sharer-late-read");
    const friendBrowser = createBrowser();
    await visit(friendBrowser, await sharer.share(6));
    const friend = await player("friend-late-read", friendBrowser);
    friend.earn(200);
    // Nobody reads the tally until three weeks later, past any window counted from the read.
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 21 * 24 * 3_600_000, shouldAdvanceTime: true });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    expect(await sharer.tally()).toMatchObject({ joined: 1, activated: 1, friendsPaid: 0, fragmentsEarned: 0 });
    const row = await env.DB.prepare(
      `SELECT j."joined_at" AS "joinedAt", CAST(strftime('%s', u."createdAt") AS INTEGER) AS "madeAt"
       FROM "share_joins" j JOIN "user" u ON u."realmsId" = j."friend" WHERE j."friend" = ?`,
    )
      .bind(friend.realmsId)
      .first<{ joinedAt: number; madeAt: number }>();
    expect(row!.joinedAt).toBe(row!.madeAt);
  });

  it("settles a join whose Herald stayed silent for weeks once it answers, and a sharer's read settles only their own", async () => {
    const sharer = await player("sharer-silent-board");
    const other = await player("sharer-other-reader");
    const friendBrowser = createBrowser();
    await visit(friendBrowser, await sharer.share(7));
    const friend = await player("friend-silent-board", friendBrowser);
    friend.earn(100);
    const activatedAt = async () =>
      (
        await env.DB.prepare(`SELECT "activated_at" AS "at" FROM "share_joins" WHERE "friend" = ?`)
          .bind(friend.realmsId)
          .first<{ at: number | null }>()
      )?.at ?? null;
    // Another sharer's read leaves this join for its own sharer's read.
    await other.tally();
    expect(await activatedAt()).toBeNull();

    heralds.delete(raceUrl);
    expect(await sharer.tally()).toMatchObject({ joined: 1, activated: 0, friendsPaid: 0, fragmentsEarned: 0 });
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 28 * 24 * 3_600_000, shouldAdvanceTime: true });
    onTestFinished(() => {
      vi.useRealTimers();
      publishRace();
    });
    publishRace();
    expect(await sharer.tally()).toMatchObject({ joined: 1, activated: 1, friendsPaid: 0, fragmentsEarned: 0 });
  });

  it("gives a new account to the first link its browser opened, and never an account older than the visit", async () => {
    const first = await player("sharer-first");
    const second = await player("sharer-second");
    const already = await player("already-playing");
    const browser = createBrowser();
    await visit(browser, await first.share(4));
    await visit(browser, await second.share(4));
    await signInWithCode(browser, "already-playing@share.test");
    await browser.session();
    await player("friend-first-touch", browser);
    expect((await first.tally()).joined).toBe(1);
    expect((await second.tally()).joined).toBe(0);
    expect(already.realmsId).not.toBe("");
  });

  it("joins no one's link to the sharer's own new account on their own browser", async () => {
    const sharer = await player("sharer-alt");
    const code = await sharer.share(5);
    await visit(sharer.browser, code);
    await player("sharer-alt-second", sharer.browser);
    expect((await sharer.tally()).joined).toBe(0);
  });

  /** The shared game's facts Herald answers for an account: its realm, and every home's Aspect. */
  const publishAspects = (account: string, aspectOfRealm: number | null) =>
    heralds.set(`${shard}/games/${gameId}/snapshot?models=Structure%2CHomeAspect&owner=${account}`, {
      game_id: String(gameId),
      confirmed_block: 1,
      models: [
        { model: "Structure", rows: [{ key: "7", value: { entity_id: "7", owner: account } }] },
        {
          model: "HomeAspect",
          rows:
            aspectOfRealm === null
              ? [{ key: "8", value: { game_id: gameId, home: "8", aspect: 1 } }]
              : [{ key: "7", value: { game_id: gameId, home: "7", aspect: aspectOfRealm } }],
        },
      ],
    });
  const ownInvite = (who: Awaited<ReturnType<typeof player>>) =>
    who.browser.request("/api/shares/invite", { method: "POST" });
  const inviteCode = async (who: Awaited<ReturnType<typeof player>>) =>
    ((await (await ownInvite(who)).json()) as { code: string }).code;
  const withoutSeasonGame = () => {
    heralds.set(`${shard}/games`, { chain: chainId, games: [] });
    onTestFinished(() => publishGames());
  };

  it("invites to the Aspect the game's Herald names for the sharer, whatever Order they pledge, and by no other route", async () => {
    const sharer = await player("inviter-luminary");
    await env.DB.prepare(`UPDATE "user" SET "name" = 'Linden' WHERE "realmsId" = ?`).bind(sharer.realmsId).run();
    publishAspects(sharer.account, 2);
    const code = await inviteCode(sharer);
    await sharer.browser.request("/api/order-intent", { body: { order: 13 } });
    expect(await inviteCode(sharer)).toBe(code);
    expect(await visit(createBrowser(), code)).toEqual([
      200,
      { kind: "aspect", moment: 2, name: "Linden", order: null, members: null },
    ]);
    const named = await sharer.browser.request("/api/shares", { body: { kind: "aspect", chainId, gameId, moment: 2 } });
    expect(named.status).toBe(400);
  });

  it("invites to the coming season before any game, to the Aspect of the Order the sharer chose, and records the friend who came by it as joined", async () => {
    withoutSeasonGame();
    const sharer = await player("season-inviter");
    await env.DB.prepare(`UPDATE "user" SET "name" = 'Dana' WHERE "realmsId" = ?`).bind(sharer.realmsId).run();
    const titans = orders.find(({ fullOrderName }) => fullOrderName === "Order of Titans")!;

    expect([(await ownInvite(sharer)).status, await (await ownInvite(sharer)).json()]).toEqual([
      409,
      { error: "no_aspect" },
    ]);
    await sharer.browser.request("/api/order-intent", { body: { order: titans.orderId } });
    const made = await ownInvite(sharer);
    expect(made.status).toBe(200);
    const { code } = (await made.json()) as { code: string };
    expect(await inviteCode(sharer)).toBe(code);

    const friendBrowser = createBrowser();
    const [status, seen] = await visit(friendBrowser, code);
    expect([status, seen]).toEqual([
      200,
      { kind: "aspect", moment: titans.aspect, name: "Dana", order: titans.orderId, members: expect.any(Number) },
    ]);
    const ally = await player("season-ally");
    const giants = orders.find(({ fullOrderName }) => fullOrderName === "Order of Giants")!;
    await ally.browser.request("/api/order-intent", { body: { order: giants.orderId } });
    expect((await visit(createBrowser(), code))[1]).toEqual({ ...seen, members: seen.members + 1 });
    const friend = await player("season-invited", friendBrowser);
    expect(await (await friend.browser.request("/api/shares/joined")).json()).toEqual({
      kind: "aspect",
      chainId: null,
      gameId: null,
      moment: titans.aspect,
      name: "Dana",
    });
    expect(await sharer.tally()).toEqual({
      links: 1,
      posted: 0,
      visits: 2,
      joined: 1,
      activated: 0,
      friendsPaid: 0,
      fragmentsEarned: 0,
    });
  });

  it("lands a pre-season invite in the Aspect its sharer plays for now, after a change before the season", async () => {
    withoutSeasonGame();
    const sharer = await player("season-switcher");
    const titans = orders.find(({ fullOrderName }) => fullOrderName === "Order of Titans")!;
    const elsewhere = orders.find(({ aspect }) => aspect !== null && aspect !== titans.aspect)!;
    await sharer.browser.request("/api/order-intent", { body: { order: titans.orderId } });
    const code = await inviteCode(sharer);
    expect((await visit(createBrowser(), code))[1]).toMatchObject({ moment: titans.aspect, order: titans.orderId });
    await sharer.browser.request("/api/order-intent", { body: { order: elsewhere.orderId } });
    expect(await (await ownInvite(sharer)).json()).toEqual({
      code,
      aspect: elsewhere.aspect,
      chainId: null,
      gameId: null,
    });
    const friendBrowser = createBrowser();
    expect((await visit(friendBrowser, code))[1]).toMatchObject({ moment: elsewhere.aspect, order: elsewhere.orderId });
    const friend = await player("season-switcher-friend", friendBrowser);
    expect(await (await friend.browser.request("/api/shares/joined")).json()).toMatchObject({
      moment: elsewhere.aspect,
    });
  });

  const joinBy = async (code: string, name: string) => {
    const browser = createBrowser();
    await visit(browser, code);
    return player(name, browser);
  };
  const minuteCron = () => settleShareInvites(shareWorldOf(env, fetchShard));
  const fragmentCredits = () =>
    relay.mock.calls
      .filter(([url]) => String(url).endsWith("/api/value/operator/fragments"))
      .map(([, init]) => JSON.parse(String(init!.body)) as Record<string, unknown>);

  it("makes a player's own invite to the Aspect its Herald names in the open Season game, and none for a player with no Aspect", async () => {
    const sharer = await player("own-inviter");
    publishAspects(sharer.account, null);
    expect([(await ownInvite(sharer)).status, await (await ownInvite(sharer)).json()]).toEqual([
      409,
      { error: "no_aspect" },
    ]);
    publishAspects(sharer.account, 4);
    const made = await ownInvite(sharer);
    expect(made.status).toBe(200);
    const answer = (await made.json()) as { code: string };
    expect(answer).toEqual({ code: expect.any(String), aspect: 4, chainId, gameId });
    expect(await (await ownInvite(sharer)).json()).toEqual(answer);
    heralds.delete(`${shard}/games/${gameId}/snapshot?models=Structure%2CHomeAspect&owner=${sharer.account}`);
    expect([(await ownInvite(sharer)).status, await (await ownInvite(sharer)).json()]).toEqual([
      503,
      { error: "aspect_unavailable" },
    ]);
    expect((await createBrowser().request("/api/shares/invite", { method: "POST" })).status).toBe(401);
  });

  it("lists the friends a player's invites brought, newest first, with their Glory and how far each went", async () => {
    const sharer = await player("friends-sharer");
    publishAspects(sharer.account, 2);
    const code = await inviteCode(sharer);
    const paid = await joinBy(code, "friends-paid");
    const playing = await joinBy(code, "friends-playing");
    const reached = await joinBy(code, "friends-reached");
    await env.DB.prepare(`UPDATE "user" SET "name" = 'Rowan' WHERE "realmsId" = ?`).bind(paid.realmsId).run();
    paid.earn(100);
    playing.earn(40);
    await minuteCron();
    reached.earn(120);
    const friends = await sharer.browser.request("/api/shares/friends");
    expect(friends.status).toBe(200);
    expect(await friends.json()).toEqual({
      friends: [
        { name: null, joinedAt: expect.any(Number), glory: 120, state: "reached" },
        { name: null, joinedAt: expect.any(Number), glory: 40, state: "joined" },
        { name: "Rowan", joinedAt: expect.any(Number), glory: 100, state: "paid" },
      ],
    });
    expect(await (await paid.browser.request("/api/shares/friends")).json()).toEqual({ friends: [] });
    expect((await createBrowser().request("/api/shares/friends")).status).toBe(401);
    await minuteCron();
    const delivered = (await (await sharer.browser.request("/api/shares/friends")).json()) as {
      friends: { state: string }[];
    };
    expect(delivered.friends.map(({ state }) => state)).toEqual(["paid", "joined", "paid"]);
  });

  it("pays an Aspect invite's sharer 100 Fragments for each of the first 10 friends at 100 Glory, and 1,000 more at the 10th", async () => {
    const sharer = await player("payout-sharer");
    publishAspects(sharer.account, 2);
    const code = await inviteCode(sharer);
    const friends = [];
    for (let index = 0; index < 11; index++) friends.push(await joinBy(code, `payout-friend-${index}`));
    relay.mockClear();
    for (const friend of friends.slice(0, 9)) friend.earn(100);
    expect(await sharer.tally()).toMatchObject({ activated: 9, friendsPaid: 0, fragmentsEarned: 0 });
    await minuteCron();
    expect(await sharer.tally()).toMatchObject({ activated: 9, friendsPaid: 9, fragmentsEarned: 900 });
    for (const friend of friends.slice(9)) friend.earn(150);
    await minuteCron();
    await minuteCron();
    expect(await sharer.tally()).toMatchObject({ activated: 11, friendsPaid: 10, fragmentsEarned: 2000 });
    const credits = fragmentCredits().filter(({ realmsId }) => realmsId === sharer.realmsId);
    expect(credits.filter(({ amount }) => amount === 100)).toHaveLength(10);
    expect(credits.filter(({ amount }) => amount === 1000)).toEqual([
      {
        id: `friends:${chainId}:${gameId}:${sharer.realmsId}`,
        realmsId: sharer.realmsId,
        chainId,
        gameId,
        amount: 1000,
      },
    ]);
  });

  it("pays nothing for a friend on the sharer's own mailbox, and the minute cron retries a credit the relay refused until it takes it, once", async () => {
    const sharer = await player("mailbox-sharer");
    publishAspects(sharer.account, 3);
    const code = await inviteCode(sharer);
    const alt = await joinBy(code, "mailbox-sharer+alt");
    const friend = await joinBy(code, "mailbox-friend");
    alt.earn(100);
    friend.earn(100);
    relay.mockClear();
    relay.mockResolvedValueOnce(Response.json({ error: "fragment_credit_unavailable" }, { status: 503 }));
    await minuteCron();
    expect(await sharer.tally()).toMatchObject({ activated: 2, friendsPaid: 0, fragmentsEarned: 0 });
    await minuteCron();
    await minuteCron();
    expect(await sharer.tally()).toMatchObject({ activated: 2, friendsPaid: 1, fragmentsEarned: 100 });
    const paid = {
      id: `friend:${chainId}:${gameId}:${friend.realmsId}`,
      realmsId: sharer.realmsId,
      chainId,
      gameId,
      amount: 100,
    };
    expect(fragmentCredits()).toEqual([paid, paid]);
  });

  it("keeps the pre-season invite while only a testnet game runs, and its Glory neither pays the sharer nor uses up the friend", async () => {
    publishGames(testnetGameName(1_801_000_000));
    onTestFinished(() => publishGames());
    const sharer = await player("testnet-sharer");
    const titans = orders.find(({ fullOrderName }) => fullOrderName === "Order of Titans")!;
    await sharer.browser.request("/api/order-intent", { body: { order: titans.orderId } });
    const made = await ownInvite(sharer);
    const invite = (await made.json()) as { code: string };
    expect(invite).toEqual({ code: expect.any(String), aspect: titans.aspect, chainId: null, gameId: null });
    const friend = await joinBy(invite.code, "testnet-friend");
    relay.mockClear();
    friend.earn(100);
    await minuteCron();
    expect(await sharer.tally()).toMatchObject({ activated: 0, friendsPaid: 0, fragmentsEarned: 0 });
    expect(fragmentCredits()).toEqual([]);
    publishGames();
    await minuteCron();
    expect(await sharer.tally()).toMatchObject({ activated: 1, friendsPaid: 1, fragmentsEarned: 100 });
    expect(fragmentCredits()).toEqual([
      { id: `friend:${chainId}:${gameId}:${friend.realmsId}`, realmsId: sharer.realmsId, chainId, gameId, amount: 100 },
    ]);
  });

  it("counts a sharer's paid friends in the newest game that paid them, never in one whose credit still waits", async () => {
    const otherGame = gameId + 1;
    withoutSeasonGame();
    const sharer = await player("two-games-sharer");
    const titans = orders.find(({ fullOrderName }) => fullOrderName === "Order of Titans")!;
    await sharer.browser.request("/api/order-intent", { body: { order: titans.orderId } });
    const code = await inviteCode(sharer);
    heralds.set(`${shard}/games`, {
      chain: chainId,
      games: [gameId, otherGame].map((id) => ({
        game_id: id,
        name: seasonGameName(1_801_000_000 + id),
        mode: "frontier",
        status: "Live",
        clock: { end_at: 0 },
      })),
    });
    onTestFinished(() => {
      publishGames();
      heralds.delete(`${shard}/games/${otherGame}/snapshot?models=RaceMember%2CStructure`);
    });
    const first = await joinBy(code, "two-games-first");
    const third = await joinBy(code, "two-games-third");
    const second = await joinBy(code, "two-games-second");
    first.earn(100);
    third.earn(100);
    await minuteCron();
    expect(await sharer.tally()).toMatchObject({ friendsPaid: 2, fragmentsEarned: 200 });
    heralds.set(`${shard}/games/${otherGame}/snapshot?models=RaceMember%2CStructure`, {
      game_id: String(otherGame),
      confirmed_block: 1,
      models: [
        {
          model: "RaceMember",
          rows: [{ key: "1", value: { game_id: otherGame, entity_id: "1", glory: String(100e9) } }],
        },
        {
          model: "Structure",
          rows: [{ key: "1", value: { game_id: otherGame, entity_id: "1", owner: second.account } }],
        },
      ],
    });
    relay.mockClear();
    relay.mockResolvedValueOnce(Response.json({ error: "fragment_credit_unavailable" }, { status: 503 }));
    expect(await sharer.tally()).toMatchObject({ activated: 3, friendsPaid: 2, fragmentsEarned: 200 });
    await minuteCron();
    expect(await sharer.tally()).toMatchObject({ friendsPaid: 2, fragmentsEarned: 200 });
    await minuteCron();
    expect(await sharer.tally()).toMatchObject({ friendsPaid: 1, fragmentsEarned: 100 });
    expect(fragmentCredits().map(({ gameId: paidIn }) => paidIn)).toEqual([otherGame, otherGame]);
  });

  it("pays nothing to a sharer who deleted their account, however late their friend earns the Glory", async () => {
    const sharer = await player("deleted-sharer");
    publishAspects(sharer.account, 4);
    const friend = await joinBy(await inviteCode(sharer), "deleted-sharer-friend");
    const user = await env.DB.prepare('SELECT * FROM "user" WHERE "realmsId" = ?').bind(sharer.realmsId).first<User>();
    await env.DB.batch(accountDeletion(env.DB, user!, sharer.realmsId, Date.now()));
    relay.mockClear();
    friend.earn(100);
    await minuteCron();
    expect(fragmentCredits()).toEqual([]);
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS "rows" FROM "share_payouts" WHERE "sharer" = ?')
        .bind(sharer.realmsId)
        .first<{ rows: number }>(),
    ).toEqual({ rows: 0 });
  });

  it("tells a new account the invite it came by, and nothing to an account no link brought", async () => {
    const sharer = await player("inviter-havoc");
    await env.DB.prepare(`UPDATE "user" SET "name" = 'Cael' WHERE "realmsId" = ?`).bind(sharer.realmsId).run();
    publishAspects(sharer.account, 3);
    const code = await inviteCode(sharer);
    const friendBrowser = createBrowser();
    await visit(friendBrowser, code);
    const friend = await player("invited-to-havoc", friendBrowser);
    expect(await (await friend.browser.request("/api/shares/joined")).json()).toEqual({
      kind: "aspect",
      chainId,
      gameId,
      moment: 3,
      name: "Cael",
    });
    const alone = await player("came-alone");
    expect(await (await alone.browser.request("/api/shares/joined")).json()).toBeNull();
    expect((await createBrowser().request("/api/shares/joined")).status).toBe(401);
  });

  it("offers an account made before it opened a friend's invite that invite's Aspect, the latest it opened, and counts no join for it", async () => {
    const sharer = await player("inviter-of-old-hand");
    await env.DB.prepare(`UPDATE "user" SET "name" = 'Maren' WHERE "realmsId" = ?`).bind(sharer.realmsId).run();
    publishAspects(sharer.account, 2);
    const code = await inviteCode(sharer);
    const oldHand = await player("old-hand");
    expect(await (await oldHand.browser.request("/api/shares/joined")).json()).toBeNull();
    await visit(sharer.browser, code);
    expect(await (await sharer.browser.request("/api/shares/joined")).json()).toBeNull();
    await visit(oldHand.browser, code);
    const offered = { kind: "aspect", chainId, gameId, moment: 2, name: "Maren" };
    expect(await (await oldHand.browser.request("/api/shares/joined")).json()).toEqual(offered);
    expect(await sharer.tally()).toMatchObject({ visits: 1, joined: 0 });

    const later = await player("later-inviter-of-old-hand");
    await env.DB.prepare(`UPDATE "user" SET "name" = 'Corin' WHERE "realmsId" = ?`).bind(later.realmsId).run();
    publishAspects(later.account, 4);
    const laterCode = await inviteCode(later);
    await visit(oldHand.browser, laterCode);
    const future = `UPDATE "share_visits" SET "at" = '2099-01-01T00:00:00.000Z' WHERE "code" = ?`;
    await env.DB.prepare(future).bind(laterCode).run();
    expect(await sharer.tally()).toMatchObject({ visits: 1, joined: 0 });
    expect(await (await oldHand.browser.request("/api/shares/joined")).json()).toEqual({
      ...offered,
      moment: 4,
      name: "Corin",
    });
  });

  it("unfurls an invite as the sharer inviting to their Aspect", async () => {
    const sharer = await player("inviter-unfurl");
    await env.DB.prepare(`UPDATE "user" SET "name" = 'Orrin' WHERE "realmsId" = ?`).bind(sharer.realmsId).run();
    publishAspects(sharer.account, 4);
    const code = await inviteCode(sharer);
    const [status, html] = await page(code);
    expect(status).toBe(200);
    expect(tag(html, "og:title")).toBe("Orrin invites you to Insight in Frontier");
  });

  /** A JPEG as the share sheet's browser makes it: its start marker, then the rest of its bytes. */
  const jpeg = (size = 2_048) => {
    const bytes = new Uint8Array(size).fill(7);
    bytes.set([0xff, 0xd8, 0xff, 0xe0]);
    return bytes;
  };
  const upload = (who: Awaited<ReturnType<typeof player>>, code: string, bytes: Uint8Array, type = "image/jpeg") =>
    who.browser.request(`/api/shares/${code}/card`, { method: "PUT", file: { bytes, type } });
  const page = async (code: string) => {
    const response = await createBrowser().request(`/s/${code}`);
    return [response.status, await response.text()] as [number, string];
  };
  const tag = (html: string, name: string) =>
    new RegExp(`<meta (?:property|name)="${name}" content="([^"]*)"`).exec(html)?.[1];

  it("keeps the card a sharer's browser made for their link, and serves it to anyone", async () => {
    const sharer = await player("sharer-card");
    const code = await sharer.share(14);
    const card = jpeg();
    expect((await upload(sharer, code, card)).status).toBe(204);
    const served = await createBrowser().request(`/api/shares/${code}/card`);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/jpeg");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(card);
    expect((await createBrowser().request(`/api/shares/${await sharer.share(15)}/card`)).status).toBe(404);
    // A link that is gone (its account's rows cascade) serves no card, whatever R2 still holds.
    await env.DB.prepare(`DELETE FROM "share_links" WHERE "code" = ?`).bind(code).run();
    expect(shareCards.objects.has(`cards/${code}.jpg`)).toBe(true);
    expect((await createBrowser().request(`/api/shares/${code}/card`)).status).toBe(404);
  });

  it("takes a card only from the link's sharer, and only a JPEG of at most a megabyte", async () => {
    const sharer = await player("sharer-card-refused");
    const other = await player("other-card-refused");
    const code = await sharer.share(16);
    expect((await upload(other, code, jpeg())).status).toBe(404);
    expect((await upload(sharer, code, jpeg(), "image/png")).status).toBe(400);
    expect((await upload(sharer, code, new Uint8Array(2_048).fill(7))).status).toBe(400);
    expect((await upload(sharer, code, jpeg(1_000_001))).status).toBe(400);
    const signedOut = createBrowser();
    expect(
      (
        await signedOut.request(`/api/shares/${code}/card`, {
          method: "PUT",
          file: { bytes: jpeg(), type: "image/jpeg" },
        })
      ).status,
    ).toBe(401);
    expect(shareCards.objects.has(`cards/${code}.jpg`)).toBe(false);
  });

  it("unfurls a shared link as its own: who shared which day, the pitch, its address, and its card once made", async () => {
    const sharer = await player("sharer-unfurl");
    await env.DB.prepare(`UPDATE "user" SET "name" = 'Ash "Walker" <3' WHERE "realmsId" = ?`)
      .bind(sharer.realmsId)
      .run();
    const code = await sharer.share(21);
    const [status, before] = await page(code);
    expect(status).toBe(200);
    expect(tag(before, "og:title")).toBe("Ash &quot;Walker&quot; &lt;3 shared Day 21 of Frontier");
    expect(before).toContain("<title>Ash &quot;Walker&quot; &lt;3 shared Day 21 of Frontier</title>");
    expect(tag(before, "og:description")).toBe(
      "A new map every day. Send your armies into the fog and bring home what they find. Your realm is free.",
    );
    expect(tag(before, "og:url")).toBe(`${ORIGIN}/s/${code}`);
    // Until the sharer's browser made the card, the game's own preview stands.
    expect(tag(before, "og:image")).toBe(`${ORIGIN}/images/covers/link-preview.png`);

    await upload(sharer, code, jpeg());
    const [, after] = await page(code);
    expect(tag(after, "og:image")).toBe(`${ORIGIN}/api/shares/${code}/card`);
    expect(tag(after, "twitter:image")).toBe(`${ORIGIN}/api/shares/${code}/card`);
    expect(tag(after, "twitter:card")).toBe("summary_large_image");
  });

  it("serves the game's page as the host answered for a link that leads nowhere", async () => {
    expect(await page("NOPE2345")).toEqual([200, GAME_PAGE]);
    expect(await page("not-a-code")).toEqual([200, GAME_PAGE]);
  });

  it("counts first visits by the tag their link carried, never the sharer's own", async () => {
    const sharer = await player("sharer-channels");
    const code = await sharer.share(30);
    const via = (browser: ReturnType<typeof createBrowser>, channel: unknown) =>
      browser.request(`/api/shares/${code}/visit`, { body: { via: channel } });
    const tagsNow = async () =>
      (
        (await (await createBrowser().request("/api/operator/shares", { token: OPERATOR_TOKEN })).json()) as {
          firstVisitsByTag: { tag: string | null; visits: number }[];
        }
      ).firstVisitsByTag;
    const before = new Map((await tagsNow()).map(({ tag, visits }) => [tag, visits]));
    await via(createBrowser(), "x");
    await via(createBrowser(), "system");
    await via(createBrowser(), "system");
    await via(createBrowser(), "telegram");
    await via(sharer.browser, "x");
    const after = new Map((await tagsNow()).map(({ tag, visits }) => [tag, visits]));
    const added = (tag: string | null) => (after.get(tag) ?? 0) - (before.get(tag) ?? 0);
    expect([added("x"), added("system"), added(null)]).toEqual([1, 2, 1]);
  });

  it("reports every moment's funnel to the operator only, and leaves joins whose Herald cannot answer for later", async () => {
    const sharer = await player("sharer-report");
    const code = await sharer.share(9);
    const friendBrowser = createBrowser();
    await visit(friendBrowser, code);
    await player("friend-report", friendBrowser);
    expect((await createBrowser().request("/api/operator/shares")).status).toBe(401);

    heralds.delete(raceUrl);
    const waiting = (await (
      await createBrowser().request("/api/operator/shares", { token: OPERATOR_TOKEN })
    ).json()) as {
      unsettledJoins: number;
    };
    expect(waiting.unsettledJoins).toBeGreaterThan(0);
    publishRace();

    const report = (await (
      await createBrowser().request("/api/operator/shares", { token: OPERATOR_TOKEN })
    ).json()) as {
      unsettledJoins: number;
      moments: Record<string, unknown>[];
      topSharers: { realmsId: string; joined: number }[];
    };
    expect(report.unsettledJoins).toBe(0);
    expect(report.moments).toContainEqual({
      kind: "frontier-day",
      chainId,
      gameId,
      moment: 9,
      links: 1,
      posted: 0,
      visits: 1,
      joined: 1,
      activated: 0,
    });
    expect(report.topSharers.find((row) => row.realmsId === sharer.realmsId)?.joined).toBe(1);
  });
});
