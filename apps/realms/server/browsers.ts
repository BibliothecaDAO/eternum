/**
 * The browser a request comes from, shared by every account signed in on it: a random id in a first-party cookie the
 * app's session read sets once and sign-out never clears. A web page cannot read its device's hardware id, and a shared
 * network (a venue's wifi) says nothing about one person, so the referral's one-person check compares browsers. A
 * private window or cleared storage starts a new one: an unknown browser proves nothing.
 */
const BROWSER_COOKIE = "realms-identity.browser";
/** The longest a browser keeps a cookie. */
const BROWSER_SECONDS = 400 * 24 * 60 * 60;
const BROWSER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** The id this browser carries; null when it has none yet, or one this service never set. */
export const browserOf = (request: Request): string | null => {
  const cookies = request.headers.get("cookie")?.split(";") ?? [];
  const value = cookies.map((cookie) => cookie.trim().split("=")).find(([name]) => name === BROWSER_COOKIE)?.[1];
  return value !== undefined && BROWSER_ID.test(value) ? value : null;
};

/** The request's browser id, set on the response when the browser had none. */
export const keepBrowser = (request: Request, headers: Headers): string => {
  const known = browserOf(request);
  if (known !== null) return known;
  const browser = crypto.randomUUID();
  headers.append(
    "set-cookie",
    `${BROWSER_COOKIE}=${browser}; Path=/api; Max-Age=${BROWSER_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
  );
  return browser;
};

/** Records that the account was signed in on this browser; the record stays after sign-out. */
export const noteBrowser = (db: D1Database, realmsId: string, browser: string) =>
  db
    .prepare('INSERT INTO "account_browsers" ("realmsId", "browser") VALUES (?, ?) ON CONFLICT DO NOTHING')
    .bind(realmsId, browser);
