import { generateKeyPairSync, verify } from "node:crypto";
import { expect, it } from "vitest";

import { appleClientSecret } from "./apple-client-secret";

it("signs Apple's client secret with the Sign in with Apple key, for less than six months", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const now = 1_800_000_000;
  const { secret, expiresAt } = appleClientSecret(
    {
      teamId: "TEAM123456",
      keyId: "KEY1234567",
      servicesId: "party.realms.signin",
      privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    },
    now,
  );

  const [header, claims, signature] = secret.split(".") as [string, string, string];
  const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString());
  expect(decode(header)).toEqual({ alg: "ES256", kid: "KEY1234567" });
  expect(decode(claims)).toEqual({
    iss: "TEAM123456",
    iat: now,
    exp: expiresAt,
    aud: "https://appleid.apple.com",
    sub: "party.realms.signin",
  });
  expect(expiresAt - now).toBe(179 * 24 * 60 * 60);
  const signed = Buffer.from(`${header}.${claims}`);
  const proof = { key: publicKey, dsaEncoding: "ieee-p1363" as const };
  expect(verify("sha256", signed, proof, Buffer.from(signature, "base64url"))).toBe(true);
  expect(verify("sha256", Buffer.from(`${header}.x${claims}`), proof, Buffer.from(signature, "base64url"))).toBe(false);
});
