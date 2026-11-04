import type { DefaultWallet, NewPasskey } from "@realms-world/identity";
import { passkeyChallenge, passkeyOwnerSignature } from "@realms-world/identity/wallet";

/** The browser cannot make or use a passkey here: no WebAuthn, or a wallet made on another site. */
export class PasskeyUnavailableError extends Error {}

const base64Url = (bytes: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
const fromBase64Url = (text: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), (character) => character.charCodeAt(0));

const hasWebAuthn = () => typeof window !== "undefined" && "PublicKeyCredential" in window;

/**
 * A new passkey for the player's default wallet, on this site: P-256 (the only key the wallet's account accepts),
 * kept by the device's password manager so it syncs to the player's other devices, and opened with their face,
 * fingerprint or screen lock every time.
 */
export const createPasskey = async (account: {
  realmsId: string;
  email: string;
  name: string;
}): Promise<NewPasskey> => {
  if (!hasWebAuthn()) throw new PasskeyUnavailableError("passkey_unsupported");
  const credential = (await navigator.credentials.create({
    publicKey: {
      rp: { id: window.location.hostname, name: "Realms" },
      // A user handle is at most 64 bytes: the Realms id's hex digits fit, its "0x" would not.
      user: {
        id: new TextEncoder().encode(account.realmsId.replace(/^0x/, "")),
        name: account.email,
        displayName: account.name,
      },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  const publicKey = (credential?.response as AuthenticatorAttestationResponse | undefined)?.getPublicKey();
  if (!credential || !publicKey) throw new PasskeyUnavailableError("passkey_not_created");
  return { credentialId: base64Url(credential.rawId), publicKey: base64Url(publicKey) };
};

/** The default wallet's owner signature over `hash`: the player's passkey asked once, then shaped as the account reads it. */
export const signWithPasskey = async (wallet: DefaultWallet, hash: string): Promise<string[]> => {
  if (!hasWebAuthn() || window.location.origin !== wallet.origin)
    throw new PasskeyUnavailableError("passkey_elsewhere");
  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: new Uint8Array(passkeyChallenge(hash)),
      rpId: wallet.rpId,
      allowCredentials: [{ type: "public-key", id: fromBase64Url(wallet.credentialId) }],
      userVerification: "required",
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new PasskeyUnavailableError("passkey_not_used");
  const response = credential.response as AuthenticatorAssertionResponse;
  return passkeyOwnerSignature(wallet, hash, {
    authenticatorData: new Uint8Array(response.authenticatorData),
    clientDataJSON: new Uint8Array(response.clientDataJSON),
    signature: new Uint8Array(response.signature),
  });
};
