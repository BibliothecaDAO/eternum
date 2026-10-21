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
const handoffKey = (state: string) => `discord-handoff:${state}`;

type Handoff = { codeHash: string; cookies: string[]; attempts: number };

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
  await holdHandoff(auth, state, { codeHash: await sha256(code), cookies, attempts: 0 });
  return handoffPage(code);
};

/** The starting browser trades the code for the session Discord gave the player in another browser. */
export const claimDiscordHandoff = async (request: Request, auth: IdentityAuth, env: IdentityEnv) => {
  const state = startStateOf(request, env);
  if (!state) return json({ code: "HANDOFF_NOT_STARTED" }, 400);
  const held = await heldHandoff(auth, state);
  if (!held) return json({ code: "OTP_EXPIRED" }, 400);
  const { code } = (await request.json().catch(() => ({}))) as { code?: unknown };
  if (typeof code === "string" && (await sha256(code.trim())) === held.codeHash) {
    await releaseHandoff(auth, state);
    return withCookies(json({ success: true }), [...held.cookies, startCookie(env, "", 0)]);
  }
  const attempts = held.attempts + 1;
  if (attempts >= HANDOFF_ATTEMPTS) {
    await releaseHandoff(auth, state);
    return json({ code: "TOO_MANY_ATTEMPTS" }, 400);
  }
  await holdHandoff(auth, state, { ...held, attempts });
  return json({ code: "INVALID_OTP" }, 400);
};

const holdHandoff = async (auth: IdentityAuth, state: string, handoff: Handoff) => {
  const { internalAdapter } = await auth.$context;
  await internalAdapter.deleteVerificationByIdentifier(handoffKey(state));
  await internalAdapter.createVerificationValue({
    identifier: handoffKey(state),
    value: JSON.stringify(handoff),
    expiresAt: new Date(Date.now() + HANDOFF_SECONDS * 1000),
  });
};

const heldHandoff = async (auth: IdentityAuth, state: string): Promise<Handoff | null> => {
  const { internalAdapter } = await auth.$context;
  const row = await internalAdapter.findVerificationValue(handoffKey(state));
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  return JSON.parse(row.value) as Handoff;
};

const releaseHandoff = async (auth: IdentityAuth, state: string) =>
  (await auth.$context).internalAdapter.deleteVerificationByIdentifier(handoffKey(state));

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
