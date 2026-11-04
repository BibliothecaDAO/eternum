import BRAND from "../../../packages/notifications/src/brand.gen.json";
import type { IdentityEnv } from "./env";

/**
 * The stop link every Realms news email carries, one per account, signed with the Worker's auth secret so nobody can
 * stop another account's emails. A GET only asks (mail scanners open links); the POST stops them, either from the
 * page's button or from the mail client's one-click unsubscribe (List-Unsubscribe-Post, RFC 8058).
 */
export const NEWS_EMAIL_OPT_OUT_PATH = "/api/email/opt-out";

/** The account's stop link on the app at baseUrl. */
export const newsEmailOptOutLink = async (baseUrl: string, secret: string, realmsId: string): Promise<string> => {
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(secret), message(realmsId)));
  const link = new URL(NEWS_EMAIL_OPT_OUT_PATH, baseUrl);
  link.searchParams.set("u", realmsId);
  link.searchParams.set("t", base64url(signature));
  return link.toString();
};

export async function handleNewsEmailOptOut(
  request: Request,
  env: Pick<IdentityEnv, "DB" | "BETTER_AUTH_SECRET">,
): Promise<Response> {
  const url = new URL(request.url);
  const realmsId = url.searchParams.get("u") ?? "";
  if (!(await isSigned(env.BETTER_AUTH_SECRET, realmsId, url.searchParams.get("t") ?? "")))
    return page(403, "This link isn't valid", "Open the link from the email again, or ask us on Discord to stop them.");
  if (request.method !== "POST")
    return page(
      200,
      "Stop Realms news emails?",
      "You'll still get your sign-in codes and payout wallet notices.",
      `<form method="post" action="${escape(url.pathname + url.search)}"><button type="submit" style="background:${GOLD};color:${INK};border:0;border-radius:8px;padding:14px 28px;font:700 16px ${FACE};cursor:pointer">Stop these emails</button></form>`,
    );
  await env.DB.prepare(
    `UPDATE "user" SET "newsEmailOptOutAt" = ?1 WHERE "realmsId" = ?2 AND "newsEmailOptOutAt" IS NULL`,
  )
    .bind(Date.now(), realmsId)
    .run();
  return page(200, "You won't get Realms news emails", "Sign-in codes and payout wallet notices still come.");
}

const message = (realmsId: string) => new TextEncoder().encode(`news-email-opt-out:${realmsId}`);

const signingKey = (secret: string) =>
  crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);

/** Checked by the platform's own verify, which compares in constant time. */
const isSigned = async (secret: string, realmsId: string, token: string): Promise<boolean> => {
  const signature = fromBase64url(token);
  if (!realmsId || !signature) return false;
  return crypto.subtle.verify("HMAC", await signingKey(secret), signature, message(realmsId));
};

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

const fromBase64url = (token: string): Uint8Array | null => {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return Uint8Array.from(atob(token.replaceAll("-", "+").replaceAll("_", "/")), (char) => char.charCodeAt(0));
};

// The emails' own colours and face, so the page reads as the email it came from.
const { ground: NIGHT, cream: CREAM, muted: MUTED, gold: GOLD, ink: INK } = BRAND.colors;
const FACE = `'${BRAND.faces.body.family}','Segoe UI',Helvetica,Arial,sans-serif`;

const escape = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const page = (status: number, title: string, line: string, action = "") =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escape(title)}</title></head>
<body style="margin:0;background:${NIGHT};font-family:${FACE};color:${CREAM}"><main style="max-width:520px;margin:0 auto;padding:64px 24px">
<p style="margin:0 0 24px;font-weight:700;color:${GOLD};letter-spacing:2px">REALMS</p>
<h1 style="margin:0 0 12px;font-size:26px;line-height:34px">${escape(title)}</h1>
<p style="margin:0 0 28px;font-size:17px;line-height:26px;color:${MUTED}">${escape(line)}</p>${action}</main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
