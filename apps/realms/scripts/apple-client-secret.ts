/**
 * Apple's OAuth "client secret" for one environment's Services ID: a JWT signed with the Sign in with Apple key, which
 * Apple accepts for at most six months. It goes into the environment's inputs.json as `appleClientSecret`, and setup's
 * apply installs it as the identity Worker's APPLE_CLIENT_SECRET.
 *
 *   pnpm --dir apps/realms apple-client-secret <team id> <key id> <services id> <AuthKey_….p8>
 *
 * prints the secret on stdout and the date it stops working on stderr. Run it again before that date; signing a new
 * one never revokes the old one, so running it twice is harmless.
 */
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Apple's longest life for a client secret, with a day to spare. */
const LIFETIME_SECONDS = 179 * 24 * 60 * 60;

export type AppleSigningKey = { teamId: string; keyId: string; servicesId: string; privateKeyPem: string };

/** The ES256 JWT Apple's token endpoint takes as the client secret, and when it expires (seconds). */
export const appleClientSecret = (key: AppleSigningKey, nowSeconds = Math.floor(Date.now() / 1000)) => {
  const expiresAt = nowSeconds + LIFETIME_SECONDS;
  const header = { alg: "ES256", kid: key.keyId };
  const claims = {
    iss: key.teamId,
    iat: nowSeconds,
    exp: expiresAt,
    aud: "https://appleid.apple.com",
    sub: key.servicesId,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = sign("sha256", Buffer.from(unsigned), {
    key: createPrivateKey(key.privateKeyPem),
    dsaEncoding: "ieee-p1363",
  });
  return { secret: `${unsigned}.${base64url(signature)}`, expiresAt };
};

const base64url = (data: string | Uint8Array) => Buffer.from(data).toString("base64url");

const main = () => {
  const [teamId, keyId, servicesId, keyFile] = process.argv.slice(2);
  if (!teamId || !keyId || !servicesId || !keyFile)
    throw new Error("usage: apple-client-secret <team id> <key id> <services id> <AuthKey_….p8>");
  const { secret, expiresAt } = appleClientSecret({
    teamId,
    keyId,
    servicesId,
    privateKeyPem: readFileSync(keyFile, "utf8"),
  });
  console.log(secret);
  console.error(`expires ${new Date(expiresAt * 1000).toISOString()}: sign a new one before then`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
