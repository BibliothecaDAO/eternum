import { realmsAccountAddress } from "./account";
import { createIdentityClient, type IdentityFetch } from "./client";

/** The guardian's approval of a shard's deployer key as the first device of its operator's Realms account there. */
export interface OperatorEnrolment {
  realmsId: string;
  deviceKey: string;
  signature: string[];
}

interface OperatorEnrolmentInput {
  /** The identity API of the environment whose guardian the shard names, e.g. https://play.realms.party/api. */
  identityUrl: string;
  shard: { chainId: string; accountClassHash: string; guardianPublicKey: string };
  /** The shard deployer's public key, which becomes the operator account's first device. */
  deviceKey: string;
  email: string;
  /** The sign-in code emailed to `email`, as the operator reads it. */
  readCode: () => Promise<string>;
  fetch?: IdentityFetch;
}

/**
 * A community shard's operator enrols the way a player's device does. They sign in to their own Realms account with an
 * emailed code, and the identity Worker approves the shard's deployer key as that account's first device on the shard's
 * chain. No operator token is involved: the shard's authority is its operator's own Realms account. The session ends as
 * soon as the approval is in hand.
 */
export const enrolOperator = async (input: OperatorEnrolmentInput): Promise<OperatorEnrolment> => {
  const identity = createIdentityClient({
    apiUrl: input.identityUrl,
    fetch: keepingSessionCookies(
      input.fetch ?? ((url, init) => globalThis.fetch(url, init)),
      new URL(input.identityUrl).origin,
    ),
  });
  await identity.sendSignInCode(input.email);
  const { user } = await identity.signInWithCode(input.email, await input.readCode());
  try {
    const account = realmsAccountAddress(user.realmsId, input.shard.accountClassHash, input.shard.guardianPublicKey);
    const signature = await identity.approveDeviceChange({
      chainId: input.shard.chainId,
      account,
      action: "ADD",
      deviceKey: input.deviceKey,
      counter: 1,
    });
    return { realmsId: user.realmsId, deviceKey: input.deviceKey, signature };
  } finally {
    await identity.signOut();
  }
};

/** A fetch that keeps the identity service's session cookie and names its origin, as a browser would, for a tool. */
const keepingSessionCookies = (fetch: IdentityFetch, origin: string): IdentityFetch => {
  const cookies = new Map<string, string>();
  return async (url, init) => {
    const headers = new Headers(init?.headers);
    headers.set("origin", origin);
    if (cookies.size > 0) headers.set("cookie", [...cookies].map(([name, value]) => `${name}=${value}`).join("; "));
    const response = await fetch(url, { ...init, headers });
    for (const header of response.headers.getSetCookie()) {
      const [pair = ""] = header.split(";");
      const separator = pair.indexOf("=");
      cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    return response;
  };
};
