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
import { byteArray, CallData, ec, hash, outsideExecution, typedData, type TypedData } from "starknet";
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
import { campaignCodeHash } from "./campaigns";
import { CAMPAIGNS } from "@realms-world/identity";
import { campaignTicketFor } from "./campaign-ticket-store";
import { createCampaignReferralStore } from "./campaign-referral-store";
import { accountKey } from "./campaign-entry";
import { ORIGIN } from "./workerd-harness";
import { createTestD1 } from "./test-d1";
import { sendCampaign, stillFits, visitRecord } from "../scripts/comeback-campaign";

/**
 * Holds this test's clock an hour short of the Devcon close (2026-11-06 18:00Z), so a campaign test keeps testing the
 * open campaign after the real close; a test of the close sets its own time past it. Only campaign tests take it: the
 * rest keep the real clock their stored timestamps are compared against.
 */
function holdDevconOpen() {
  const open = CAMPAIGNS["devcon-2026"].redeemUntil * 1000 - 3_600_000;
  if (Date.now() <= open) return;
  vi.useFakeTimers({ toFake: ["Date"], now: open, shouldAdvanceTime: true });
  onTestFinished(() => {
    vi.useRealTimers();
  });
}

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
    DISCORD_CLIENT_ID: "discord-client",
    DISCORD_CLIENT_SECRET: "discord-secret",
    RESEND_API_KEY: "unused",
    WEB_PUSH_VAPID_PUBLIC_KEY: "unused",
    WEB_PUSH_VAPID_PRIVATE_KEY: "unused",
    SHARD_NOTIFIER: {} as IdentityEnv["SHARD_NOTIFIER"],
    CHAT_ROOM: {} as IdentityEnv["CHAT_ROOM"],
    CHAT_INBOX: {} as IdentityEnv["CHAT_INBOX"],
    DB: database.db,
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
        cache: noCache,
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

  const now = () => Math.floor(Date.now() / 1000);
  const lastSeen = async (realmsId: string) =>
    visitRecord.seconds(
      ((await database.db.prepare(visitRecord.lastVisit(realmsId)).first()) as { lastSeenAt?: unknown } | null)
        ?.lastSeenAt,
    );
  const setLastSeen = (realmsId: string, seconds: number) =>
    database.db
      .prepare('UPDATE "user" SET "lastSeenAt" = ? WHERE "realmsId" = ?')
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
    const sessionsLeft = await database.db
      .prepare('SELECT count(*) AS n FROM "session" s JOIN "user" u ON u.id = s."userId" WHERE u."realmsId" = ?')
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
    await database.db
      .prepare(
        "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)",
      )
      .run();
    const recordBegan = (secondsAgo: number) =>
      database.db
        .prepare(
          "INSERT INTO d1_migrations (name, applied_at) VALUES ('0026_last_seen.sql', ?1) ON CONFLICT(name) DO UPDATE SET applied_at = ?1",
        )
        .bind(new Date((now() - secondsAgo) * 1000).toISOString().slice(0, 19).replace("T", " "))
        .run();
    /** The sender's own reads (when the record began, the account's last visit) and rule, at this moment. */
    const stillAway = async (realmsId: string, lastAction = 0) => {
      const { results } = await database.db.prepare(visitRecord.began).all();
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
      const live = await database.db
        .prepare("SELECT count(*) AS n FROM discord_handoffs WHERE code_hash = ?1 AND attempts < 3")
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
        database.db
          .prepare("SELECT attempts, expires_at FROM discord_handoffs WHERE code_hash = ?1")
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
    beforeEach(holdDevconOpen);
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
    holdDevconOpen();
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
    holdDevconOpen();
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
    holdDevconOpen();
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
    beforeEach(holdDevconOpen);
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

    /** A browser the app opened in before, under the id it was given there: another account signing in on it. */
    const sameBrowserAs = (browserId: string) => createBrowser([`realms-identity.browser=${browserId}`]);
    /**
     * A signed-in player, each by default with their own mailbox on their own browser, which the app opens by reading
     * its session. `email` shares another's mailbox; `on` signs in on another player's browser; `opened: false` signs
     * in on a browser the app has not opened in since, so no browser is known for the account yet.
     */
    const player = async (
      name: string,
      { email, on, opened = true }: { email?: string; on?: string; opened?: boolean } = {},
    ) => {
      const address = email ?? `${name}@realms.test`;
      const browser = on ? sameBrowserAs(on) : createBrowser();
      await signInWithCode(browser, address);
      const realmsId = opened
        ? (await browser.session())!.user.realmsId
        : (await env.DB.prepare('SELECT "realmsId" FROM "user" WHERE "email" = ?')
            .bind(address.toLowerCase())
            .first<{ realmsId: string }>())!.realmsId;
      await heraldsAnswerFor(realmsId, { [shard]: false });
      const account = accountKey(realmsAccountAddress(realmsId, ACCOUNT_CLASS_HASH, await env.GUARDIAN.publicKey()));
      const call = async (path: string, body?: unknown) => {
        await publishHeralds();
        const response = await browser.request(path, body === undefined ? {} : { body });
        return [response.status, await response.json()] as [number, any];
      };
      return {
        browser,
        realmsId,
        /** The id of the browser this player signed in on first; null until the app opens there. */
        browserId: async () =>
          (
            await env.DB.prepare('SELECT "browser" FROM "account_browsers" WHERE "realmsId" = ? ORDER BY rowid LIMIT 1')
              .bind(realmsId)
              .first<{ browser: string }>()
          )?.browser ?? null,
        /** The app opens in this player's browser, reading its session. */
        open: () => browser.session(),
        /** Signs in on another player's browser too, where the app opens. */
        signInOn: async (browserId: string) => {
          const other = sameBrowserAs(browserId);
          await signInWithCode(other, address);
          await other.session();
        },
        /** Signs out, as the client does: the session goes, and the browser keeps its id. */
        signOut: async () => expect((await browser.request("/api/auth/sign-out", { body: {} })).status).toBe(200),
        signIn: () => signInWithCode(browser, address),
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

    it("counts one person once: a friend sharing a mailbox or browser with the inviter or a counted friend is excluded", async () => {
      const inviter = await player("ref-alts", { email: "Ref.Alts@gmail.com" });
      inviter.found("free");
      const code = await inviter.code();
      const join = async (name: string, options: { email?: string; on?: string; opened?: boolean }) => {
        const friend = await player(name, options);
        expect(await friend.redeem({ referral: code })).toEqual(ticket("regular"));
        friend.found("campaign", 1);
        return friend;
      };
      // The inviter's own inbox by Gmail's dots and +tags, and the inviter's own browser: neither counts.
      await join("ref-alts-mail", { email: "refalts+two@googlemail.com" });
      await join("ref-alts-browser", { on: (await inviter.browserId())! });
      expect((await inviter.referral())[1]).toEqual(answer("free", ["excluded", "excluded"]));
      expect(await campaignTicketFor(env.DB, inviter.realmsId, 6)).toBeNull();
      // A friend of their own counts; another on that friend's browser does not; one whose browser the app has not
      // opened in yet waits for it.
      const real = await join("ref-alts-real", {});
      await join("ref-alts-copy", { on: (await real.browserId())! });
      const later = await join("ref-alts-later", { opened: false });
      expect((await inviter.referral())[1]).toEqual(
        answer("ticket", ["excluded", "excluded", "counted", "excluded", "founded"], {
          tier: "regular",
          earned: { ticket: true },
        }),
      );
      await later.open();
      expect((await inviter.referral())[1].friends.map(({ state }: { state: string }) => state)).toEqual([
        "excluded",
        "excluded",
        "counted",
        "excluded",
        "counted",
      ]);
    });

    it("excludes a second account on the inviter's browser through sign-outs, and never counts two accounts for each other", async () => {
      // The owner's test: two accounts on one browser, each taking the other's link.
      const first = await player("ref-same-first");
      first.found("free");
      const firstCode = await first.code();
      const shared = (await first.browserId())!;
      await first.signOut();
      const second = await player("ref-same-second", { on: shared });
      expect(await second.redeem({ referral: firstCode })).toEqual(ticket("regular"));
      second.found("campaign", 1);
      // Back on its browser after signing out, the first account finds it under the same one id.
      await first.signIn();
      await first.open();
      const browsers = await env.DB.prepare('SELECT "browser" FROM "account_browsers" WHERE "realmsId" = ?')
        .bind(first.realmsId)
        .all<{ browser: string }>();
      expect(browsers.results).toEqual([{ browser: shared }]);
      expect((await first.referral())[1]).toEqual(answer("free", ["excluded"]));
      expect(await campaignTicketFor(env.DB, first.realmsId, 6)).toBeNull();
      // The older account takes the newer one's link: it gets its ticket, but brought the newer one no friend.
      expect(await first.redeem({ referral: await second.code() })).toEqual(ticket("regular"));
      expect(await referralRows(first)).toEqual([]);
      expect((await second.referral())[1].friends).toEqual([]);
      // So does an older account on a browser of its own.
      const elder = await player("ref-same-elder");
      const newcomer = await player("ref-same-newcomer");
      expect(await elder.redeem({ referral: await newcomer.code() })).toEqual(ticket("regular"));
      expect(await referralRows(elder)).toEqual([]);
    });

    it("counts one person once when settlements race, each deciding from its own snapshot", async () => {
      const inviter = await player("ref-racing");
      inviter.found("free");
      const code = await inviter.code();
      const inviterBrowser = (await inviter.browserId())!;
      const own = { mailbox: "ref-racing@realms.test", browsers: [inviterBrowser] };
      const store = createCampaignReferralStore(env.DB);
      const join = async (name: string, options: { email?: string; on?: string }) => {
        const friend = await player(name, options);
        expect(await friend.redeem({ referral: code })).toEqual(ticket("regular"));
        friend.found("campaign", 1);
        return friend;
      };
      // Shared browser: an older read decided to count the later friend, a newer one the earlier; both writes land.
      const first = await join("ref-racing-a", {});
      const shared = (await first.browserId())!;
      const second = await join("ref-racing-b", { on: shared });
      await store.markCounted(campaign, inviter.realmsId, own, [{ friend: second.realmsId, browser: shared }], 1);
      await store.markCounted(campaign, inviter.realmsId, own, [{ friend: first.realmsId, browser: shared }], 2);
      // Shared mailbox: the same race between two aliases of one inbox, on their own browsers.
      const third = await join("ref-racing-c", { email: "racer@gmail.com" });
      const fourth = await join("ref-racing-d", { email: "ra.cer+alt@gmail.com" });
      await store.markCounted(
        campaign,
        inviter.realmsId,
        own,
        [{ friend: fourth.realmsId, browser: (await fourth.browserId())! }],
        3,
      );
      await store.markCounted(
        campaign,
        inviter.realmsId,
        own,
        [{ friend: third.realmsId, browser: (await third.browserId())! }],
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
      // Nor does a write for the inviter's own mailbox or browser count anyone.
      const self = await join("ref-racing-self", { on: inviterBrowser });
      await store.markCounted(campaign, inviter.realmsId, own, [{ friend: self.realmsId, browser: inviterBrowser }], 5);
      expect((await inviter.referral())[1].link.counted).toBe(2);
    });

    it("compares every browser each friend was signed in on, not only the one kept, in sequence and when writes race", async () => {
      const inviter = await player("ref-allbrowsers");
      inviter.found("free");
      const code = await inviter.code();
      const own = { mailbox: "ref-allbrowsers@realms.test", browsers: [(await inviter.browserId())!] };
      const [a1, a2, c1, c2, c3] = Array.from({ length: 5 }, () => crypto.randomUUID());
      const join = async (name: string, browsers: string[]) => {
        const friend = await player(name, { on: browsers[0]! });
        for (const browser of browsers.slice(1)) await friend.signInOn(browser);
        expect(await friend.redeem({ referral: code })).toEqual(ticket("regular"));
        return friend;
      };
      // In sequence: A was on a1 and a2 and is kept on a1; it counts. B, on a2 alone, qualifies on a later read.
      const a = await join("ref-allbrowsers-a", [a1!, a2!]);
      a.found("campaign", 1);
      expect((await inviter.referral())[1].friends.map(({ state }: { state: string }) => state)).toEqual(["counted"]);
      const b = await join("ref-allbrowsers-b", [a2!]);
      b.found("campaign", 1);
      expect((await inviter.referral())[1]).toEqual(
        answer("ticket", ["counted", "excluded"], { tier: "regular", earned: { ticket: true } }),
      );
      // Racing writes, the shared c3 neither friend's kept browser: the second write counts no one.
      const store = createCampaignReferralStore(env.DB);
      const c = await join("ref-allbrowsers-c", [c1!, c3!]);
      const d = await join("ref-allbrowsers-d", [c2!, c3!]);
      c.found("campaign", 1);
      d.found("campaign", 1);
      await store.markCounted(campaign, inviter.realmsId, own, [{ friend: d.realmsId, browser: c2! }], 10);
      await store.markCounted(campaign, inviter.realmsId, own, [{ friend: c.realmsId, browser: c1! }], 11);
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
    expect(await applyPendingMigrations(database.db)).toEqual(["0031_clear_unnamed_name_suggestions.sql"]);
    const cleared = async () => {
      expect(await suggestionOf(database.db, "john.private@realms.test")).toEqual({ unnamed: 1, suggested: null });
      expect(await suggestionOf(database.db, "old.unnamed@realms.test")).toEqual({ unnamed: 1, suggested: null });
      // A Discord account not yet named cannot be told from a linked one: it picks its name too.
      expect(await suggestionOf(database.db, "rook@discord.test")).toEqual({ unnamed: 1, suggested: null });
      expect(await suggestionOf(database.db, "old.named@realms.test")).toEqual({ unnamed: 0, suggested: "oldnamed" });
    };
    await cleared();
    // A repeat deploy has nothing pending, and 0031 run again, as after a crash halfway, changes nothing.
    expect(await applyPendingMigrations(database.db)).toEqual([]);
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
      expect(await applyPendingMigrations(fresh.db)).toEqual(["0031_clear_unnamed_name_suggestions.sql"]);
      expect(await applyPendingMigrations(fresh.db)).toEqual([]);
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
