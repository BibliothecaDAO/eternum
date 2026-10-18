import { expect, it } from "vitest";
import { verifyAccess } from "./access";

const encode = (value: object) =>
  btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
/** A token naming a key; it is refused before its signature is read, so the signature can be anything. */
const naming = (kid: string) => `${encode({ alg: "RS256", kid, typ: "JWT" })}.${encode({})}.c2ln`;
const counting = () => {
  const fetched: string[] = [];
  const send = async (url: string) => {
    fetched.push(url);
    return Response.json({ keys: [{ kty: "RSA", kid: "key-1" }] });
  };
  return { fetched, send };
};

it("reads the Access keys at most once for a token naming a key nobody published, cache cold or warm", async () => {
  const policy = { teamDomain: "cold.cloudflareaccess.com", audience: "aud" };
  const cold = counting();
  await expect(verifyAccess(naming("key-9"), policy, cold.send, 1_000)).rejects.toThrow("Unknown Access signing key");
  expect(cold.fetched).toEqual(["https://cold.cloudflareaccess.com/cdn-cgi/access/certs"]);
  // Kept from that read: a token naming another unknown key reads the keys once more, then is refused.
  const warm = counting();
  await expect(verifyAccess(naming("key-8"), policy, warm.send, 2_000)).rejects.toThrow("Unknown Access signing key");
  expect(warm.fetched).toHaveLength(1);
});
