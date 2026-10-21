import type { IdentityAuth } from "./auth";
import type { IdentityEnv } from "./env";
import { json } from "./http";

/**
 * Discord's return, wherever a phone opens it. A phone often finishes Discord in another cookie jar than the one that
 * started it: an iPhone's home-screen app opens Discord in Safari's view, the Discord app hands its answer to the
 * default browser. The session belongs to the browser that started, so it never lands in another one:
 *
 * - the start marks its browser with the sign-in's state (`START_COOKIE`);
 * - a return in that browser signs it in as before;
 * - a return in another browser completes Discord there but keeps the session back, and shows a one-time code instead;
 * - the starting browser, and only it, trades that code for the session (`claimDiscordHandoff`).
 *
 * A browser that did not start can therefore never be signed in by someone else's Discord link, and a link someone
 * else started gives them nothing without the code shown to the player who finished it.
 */
const START_COOKIE = "realms-identity.discord_start";
/** As long as better-auth keeps the sign-in's state. */
const START_SECONDS = 10 * 60;
const HANDOFF_SECONDS = 10 * 60;
const HANDOFF_ATTEMPTS = 3;

/** Starts a social sign-in and marks this browser as the one it belongs to. */
export const startSocialSignIn = async (request: Request, auth: IdentityAuth, env: IdentityEnv) => {
  const started = await auth.handler(request);
  if (!started.ok) return started;
  const { url } = (await started.clone().json()) as { url?: string };
  const state = url ? new URL(url).searchParams.get("state") : null;
  if (!state) return started;
  return withCookies(started, [startCookie(env, state, START_SECONDS)]);
};

/** Discord's answer: the session for the browser that started, a code for the player in any other. */
export const returnFromDiscord = async (request: Request, auth: IdentityAuth, env: IdentityEnv) => {
  const query = new URL(request.url).searchParams;
  const state = query.get("state");
  const returned = await auth.handler(request);
  if (!state) return returned;
  if (startStateOf(request, env) === state) return withCookies(returned, [startCookie(env, "", 0)]);
  const cookies = returned.headers.getSetCookie();
  if (!cookies.some(isSessionCookie)) return returned;
  const code = sixDigits();
  await holdHandoff(env.DB, state, await sha256(code), cookies);
  return handoffPage(code);
};

/**
 * The starting browser trades the code for the session Discord gave the player in another browser. Each claim is one
 * statement, so concurrent claims cannot both take the session or share a try: a right code takes the row while it has
 * tries left, a wrong one spends a try on the row as it stands, and nothing ever writes a taken row back.
 */
export const claimDiscordHandoff = async (request: Request, env: IdentityEnv) => {
  const state = startStateOf(request, env);
  if (!state) return json({ code: "HANDOFF_NOT_STARTED" }, 400);
  const { code } = (await request.json().catch(() => ({}))) as { code?: unknown };
  const codeHash = await sha256(typeof code === "string" ? code.trim() : "");
  const taken = await takeHandoff(env.DB, state, codeHash);
  if (taken) return withCookies(json({ success: true }), [...taken, startCookie(env, "", 0)]);
  const attempts = await spendHandoffTry(env.DB, state);
  if (attempts === null) return json({ code: "OTP_EXPIRED" }, 400);
  if (attempts < HANDOFF_ATTEMPTS) return json({ code: "INVALID_OTP" }, 400);
  await env.DB.prepare("DELETE FROM discord_handoffs WHERE state = ?1").bind(state).run();
  return json({ code: "TOO_MANY_ATTEMPTS" }, 400);
};

/** Holds Discord's session for the starting browser; a held one long expired is cleared on the way. */
const holdHandoff = async (db: D1Database, state: string, codeHash: string, cookies: readonly string[]) => {
  const now = Date.now();
  await db.batch([
    db.prepare("DELETE FROM discord_handoffs WHERE expires_at < ?1").bind(now),
    db
      .prepare(
        "INSERT OR REPLACE INTO discord_handoffs (state, code_hash, cookies, attempts, expires_at) VALUES (?1, ?2, ?3, 0, ?4)",
      )
      .bind(state, codeHash, JSON.stringify(cookies), now + HANDOFF_SECONDS * 1000),
  ]);
};

/** The held session's cookies, taken by the right code while the hold has tries and time left; null otherwise. */
const takeHandoff = async (db: D1Database, state: string, codeHash: string): Promise<string[] | null> => {
  const row = await db
    .prepare(
      "DELETE FROM discord_handoffs WHERE state = ?1 AND code_hash = ?2 AND attempts < ?3 AND expires_at > ?4 RETURNING cookies",
    )
    .bind(state, codeHash, HANDOFF_ATTEMPTS, Date.now())
    .first<{ cookies: string }>();
  return row ? (JSON.parse(row.cookies) as string[]) : null;
};

/** Spends one try on a live hold and returns the tries spent; null when there is no live hold to spend it on. */
const spendHandoffTry = async (db: D1Database, state: string): Promise<number | null> => {
  const row = await db
    .prepare(
      "UPDATE discord_handoffs SET attempts = attempts + 1 WHERE state = ?1 AND attempts < ?2 AND expires_at > ?3 RETURNING attempts",
    )
    .bind(state, HANDOFF_ATTEMPTS, Date.now())
    .first<{ attempts: number }>();
  return row?.attempts ?? null;
};

/** better-auth's session cookie, under our prefix and its `__Secure-` form. */
const isSessionCookie = (cookie: string) => /^(?:__Secure-)?realms-identity\.session_token=[^;]/.test(cookie);

const isSecure = (env: IdentityEnv) => new URL(env.BASE_URL).protocol === "https:";
const startCookieName = (env: IdentityEnv) => (isSecure(env) ? `__Secure-${START_COOKIE}` : START_COOKIE);

const startCookie = (env: IdentityEnv, state: string, maxAge: number) =>
  [
    `${startCookieName(env)}=${state}`,
    `Max-Age=${maxAge}`,
    "Path=/api/auth",
    "HttpOnly",
    "SameSite=Lax",
    ...(isSecure(env) ? ["Secure"] : []),
  ].join("; ");

const startStateOf = (request: Request, env: IdentityEnv): string | null => {
  const name = `${startCookieName(env)}=`;
  const cookie = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(name));
  return cookie ? cookie.slice(name.length) || null : null;
};

const withCookies = (response: Response, cookies: readonly string[]) => {
  const headers = new Headers(response.headers);
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

const sixDigits = () => String(crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000).padStart(6, "0");

const sha256 = async (value: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

/** The page the other browser shows: the code, and where it goes. Nothing else loads. */
const handoffPage = (code: string) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Realms: your Discord code</title>
<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#15110d;color:#f3e7d3;font:16px/1.5 system-ui,sans-serif}
main{max-width:22rem;padding:24px;text-align:center}h1{font-size:20px;margin:0 0 8px}
p{color:#bfae93;margin:0 0 20px}.code{font:700 40px/1 ui-monospace,monospace;letter-spacing:.2em;color:#e2ac56;margin:8px 0 20px}</style></head>
<body><main><h1>Discord signed you in</h1><p>Go back to Realms, where you pressed Discord, and enter this code.</p>
<div class="code">${code}</div><p>It works once, for 10 minutes. Never give it to anyone.</p></main></body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
