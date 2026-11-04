import { p256 } from "@noble/curves/nist";
import { sha256 } from "@noble/hashes/sha2";
import { counterfactualAddress } from "./account";

/**
 * A Realms default wallet: a Ready (Argent) 0.5.0 account owned by the player's passkey, with the Realms guardian as
 * its guardian. Everything here follows argent-contracts-starknet v0.5.0: the signer and signature layouts in
 * `src/signer/signer_signature.cairo` and `src/signer/webauthn.cairo`, the constructor `(owner: Signer, guardian:
 * Option<Signer>)` and the owner-then-guardian signature in `src/multiowner_account/argent_account.cairo`. The identity
 * Worker, the guardian and the game share it, so the address the Worker records is the one the passkey signs for.
 */

/** Ready Account 0.5.0 (argent-contracts-starknet `deployments/account.txt`): the class every default wallet runs. */
export const READY_ACCOUNT_CLASS_HASH = "0x73414441639dcd11d1846f287650a00c60c416b9d3ba45d31c651672125b2c2";

/** A passkey as the account stores it: the page origin and relying party it was made on, and its P-256 key's x. */
export interface PasskeyOwner {
  origin: string;
  rpId: string;
  publicKeyX: string;
}

/** What deploys a default wallet at its address: the paymaster's deployment data, in its own field names. */
interface WalletDeploymentData {
  address: string;
  class_hash: string;
  salt: string;
  calldata: string[];
  version: 1;
}

/** The guardian's Stark signature over the same hash the passkey signed. */
interface GuardianSignature {
  publicKey: string;
  r: string;
  s: string;
}

/** A WebAuthn assertion as the browser returns it (navigator.credentials.get): the three byte strings the key signed. */
interface PasskeyAssertion {
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
  /** The DER-encoded P-256 signature. */
  signature: Uint8Array;
}

/** A passkey answer the account would refuse, named so the caller can say why. */
export class PasskeyAssertionError extends Error {}

const SIGNER_STARKNET = 0n;
const SIGNER_WEBAUTHN = 4n;
const OPTION_SOME = 0n;
const ACCOUNT_SIGNATURES = 2n;
const USER_PRESENT_AND_VERIFIED = 0b101;
/** rpIdHash, flags and the sign count: the account rebuilds exactly these 37 bytes, so no extension data may follow. */
const AUTHENTICATOR_DATA_LENGTH = 37;
/** The DER header of a P-256 public key (id-ecPublicKey, prime256v1, an uncompressed point). */
const P256_SPKI_HEADER = "3059301306072a8648ce3d020106082a8648ce3d030107034200";

const toHex = (value: bigint): string => `0x${value.toString(16)}`;
const bytesToBigInt = (bytes: Uint8Array): bigint =>
  bytes.length === 0 ? 0n : BigInt(`0x${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`);
const u256 = (value: bigint): bigint[] => [value & ((1n << 128n) - 1n), value >> 128n];
const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
/** A Cairo `Span<u8>`: its length, then one felt per byte. */
const byteSpan = (bytes: Uint8Array): bigint[] => [BigInt(bytes.length), ...[...bytes].map(BigInt)];

/** `WebauthnSigner { origin, rp_id_hash, pubkey }`, serialized. */
const webauthnSignerFelts = (owner: PasskeyOwner): bigint[] => [
  ...byteSpan(utf8(owner.origin)),
  ...u256(bytesToBigInt(sha256(utf8(owner.rpId)))),
  ...u256(BigInt(owner.publicKeyX)),
];

/**
 * The account's constructor calldata: `Signer::Webauthn(passkey)`, then `Option::Some(Signer::Starknet(guardian))`.
 */
export const defaultWalletCalldata = (owner: PasskeyOwner, guardianPublicKey: string): string[] => [
  ...passkeySigner(owner),
  ...[OPTION_SOME, SIGNER_STARKNET, BigInt(guardianPublicKey)].map(toHex),
];

/** `Signer::Webauthn(passkey)`, serialized: the constructor's owner, and the new owner a recovery names. */
export const passkeySigner = (owner: PasskeyOwner): string[] =>
  [SIGNER_WEBAUTHN, ...webauthnSignerFelts(owner)].map(toHex);

/**
 * The wallet's own entrypoints the Realms guardian takes part in, the owner escape that recovers a lost passkey: its
 * start and its finish, which the guardian signs alone, and its cancel, which the owner signs with the guardian. Every
 * other call to the wallet itself the guardian refuses.
 */
export const WALLET_RECOVERY = {
  start: "trigger_escape_owner",
  finish: "escape_owner",
  cancel: "cancel_escape",
} as const;

/**
 * The account's deployment, salted with the Realms id so one account's wallet is never another's even if a key
 * repeats; its address is known before anything is deployed.
 */
export const defaultWalletDeployment = (
  owner: PasskeyOwner,
  guardianPublicKey: string,
  realmsId: string,
): WalletDeploymentData => {
  const calldata = defaultWalletCalldata(owner, guardianPublicKey);
  return {
    address: counterfactualAddress(realmsId, READY_ACCOUNT_CLASS_HASH, calldata),
    class_hash: READY_ACCOUNT_CLASS_HASH,
    salt: toHex(BigInt(realmsId)),
    calldata,
    version: 1,
  };
};

/** The x of a passkey's public key, from the SubjectPublicKeyInfo the browser returns at creation; refused unless P-256. */
export const passkeyPublicKeyX = (spki: Uint8Array): string => {
  const header = [...spki.subarray(0, 26)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (spki.length !== 91 || header !== P256_SPKI_HEADER) throw new PasskeyAssertionError("passkey_not_p256");
  const point = p256.ProjectivePoint.fromHex(spki.subarray(26));
  point.assertValidity();
  return toHex(point.toAffine().x);
};

/** The WebAuthn challenge for a hash: its 32 big-endian bytes, base64url without padding (`encode_challenge`). */
export const passkeyChallenge = (hash: string): Uint8Array => {
  const value = BigInt(hash);
  return Uint8Array.from({ length: 32 }, (_, index) => Number((value >> BigInt(8 * (31 - index))) & 0xffn));
};

const base64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

/**
 * The owner's `SignerSignature::Webauthn` for `hash`, from the passkey's assertion: checked as the account checks it
 * (relying party, user present and verified, the client data's opening naming this challenge and origin), its `s`
 * made low and its `y_parity` found by recovering the passkey's own key.
 */
export const passkeyOwnerSignature = (owner: PasskeyOwner, hash: string, assertion: PasskeyAssertion): string[] => {
  const { authenticatorData, clientDataJSON } = assertion;
  if (authenticatorData.length !== AUTHENTICATOR_DATA_LENGTH) throw new PasskeyAssertionError("passkey_extension_data");
  if (bytesToBigInt(authenticatorData.subarray(0, 32)) !== bytesToBigInt(sha256(utf8(owner.rpId))))
    throw new PasskeyAssertionError("passkey_wrong_relying_party");
  const flags = authenticatorData[32]!;
  if ((flags & USER_PRESENT_AND_VERIFIED) !== USER_PRESENT_AND_VERIFIED)
    throw new PasskeyAssertionError("passkey_unverified_user");
  const signCount = bytesToBigInt(authenticatorData.subarray(33, 37));
  const opening = `{"type":"webauthn.get","challenge":"${base64Url(passkeyChallenge(hash))}","origin":"${owner.origin}"`;
  const json = new TextDecoder().decode(clientDataJSON);
  const outro = clientDataOutro(json, opening);
  const signed = sha256(new Uint8Array([...authenticatorData, ...sha256(clientDataJSON)]));
  const { r, s, yParity } = lowSWithParity(assertion.signature, signed, BigInt(owner.publicKeyX));
  return [
    SIGNER_WEBAUTHN,
    ...webauthnSignerFelts(owner),
    ...byteSpan(outro),
    BigInt(flags),
    signCount,
    ...u256(r),
    ...u256(s),
    yParity,
  ].map(toHex);
};

/** Where the wallet's owner escape stands (`EscapeStatus`): none, waiting out its 7 days, ready to finish, or expired. */
type EscapeStatus = "none" | "waiting" | "ready" | "expired";
export interface WalletEscape {
  status: EscapeStatus;
  /** Unix seconds from which it can be finished; null with no escape. */
  readyAt: number | null;
}

const ESCAPE_STATUSES: EscapeStatus[] = ["none", "waiting", "ready", "expired"];

/** `get_escape_and_status()`'s answer, (Escape { ready_at, escape_type, new_signer }, EscapeStatus), as a WalletEscape. */
export const walletEscapeOf = (result: readonly string[]): WalletEscape => {
  const status = ESCAPE_STATUSES[Number(BigInt(result.at(-1) ?? "-1"))];
  if (!status) throw new Error("unknown_escape_status");
  return { status, readyAt: status === "none" ? null : Number(BigInt(result[0]!)) };
};

/** The guardian's signature alone, as an escape's start and finish take it: its `r` and `s` (`parse_single_guardian_signature`). */
export const guardianAloneSignature = (guardian: Pick<GuardianSignature, "r" | "s">): string[] => [
  guardian.r,
  guardian.s,
];

/** The account's signature: the owner's, then the guardian's `SignerSignature::Starknet`. */
export const defaultWalletSignature = (ownerSignature: string[], guardian: GuardianSignature): string[] =>
  [
    ACCOUNT_SIGNATURES,
    ...ownerSignature.map(BigInt),
    SIGNER_STARKNET,
    BigInt(guardian.publicKey),
    BigInt(guardian.r),
    BigInt(guardian.s),
  ].map(toHex);

/**
 * What follows the origin in the client data, as `encode_client_data_json` takes it: nothing when the object closes
 * there, else the rest, which must start with a comma (`,"crossOrigin":false}`).
 */
const clientDataOutro = (json: string, opening: string): Uint8Array => {
  if (!json.startsWith(opening)) throw new PasskeyAssertionError("passkey_wrong_client_data");
  const rest = json.slice(opening.length);
  if (rest === "}") return new Uint8Array();
  if (!rest.startsWith(",")) throw new PasskeyAssertionError("passkey_wrong_client_data");
  return utf8(rest);
};

/** The account accepts only low `s` (`argent/malleable-signature`); its `y_parity` is the one that recovers our key. */
const lowSWithParity = (der: Uint8Array, digest: Uint8Array, publicKeyX: bigint) => {
  let signature: ReturnType<typeof p256.Signature.fromDER>;
  try {
    signature = p256.Signature.fromDER(der).normalizeS();
  } catch {
    throw new PasskeyAssertionError("passkey_signature_malformed");
  }
  for (const yParity of [0n, 1n]) {
    const recovered = signature.addRecoveryBit(Number(yParity)).recoverPublicKey(digest);
    if (recovered.toAffine().x === publicKeyX) return { r: signature.r, s: signature.s, yParity };
  }
  throw new PasskeyAssertionError("passkey_wrong_key");
};
