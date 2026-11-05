import { p256 } from "@noble/curves/nist";
import { sha256 } from "@noble/hashes/sha2";
import { ec, hash as starknetHash } from "starknet";
import { describe, expect, it } from "vitest";

import {
  callsMatch,
  WALLET_GAS_TOKEN,
  passkeySignerGuid,
  walletEscapeOf,
  READY_ACCOUNT_CLASS_HASH,
  defaultWalletCalldata,
  defaultWalletDeployment,
  defaultWalletSignature,
  passkeyChallenge,
  passkeyOwnerSignature,
  passkeyPublicKeyX,
  PasskeyAssertionError,
  type PasskeyOwner,
} from "./wallet";

const ORIGIN = "https://play.realms.party";
const RP_ID = "play.realms.party";
const REALMS_ID = "0x4d2b1c0e9a2f3d5b7c1e0f2a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6";
const GUARDIAN_KEY = "0x2dccce1da22003777062ee0870e9881b460a8b7eca276870f57c601f182136c";
const GUARDIAN = ec.starkCurve.getStarkKey(GUARDIAN_KEY);
const HASH = "0x5f0c3b4a1e2d6c7b8a9f0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1";

const utf8 = (text: string) => new TextEncoder().encode(text);
const base64Url = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");

/** A passkey as an authenticator holds it: a P-256 key made for one relying party. */
const passkey = (privateKey = p256.utils.randomPrivateKey()) => {
  const point = p256.ProjectivePoint.fromPrivateKey(privateKey);
  const owner: PasskeyOwner = { origin: ORIGIN, rpId: RP_ID, publicKeyX: `0x${point.toAffine().x.toString(16)}` };
  return { privateKey, point, owner };
};

/** What a browser returns from navigator.credentials.get for `hash`, with the knobs an authenticator varies. */
const assert = (
  key: ReturnType<typeof passkey>,
  hash: string,
  options: { flags?: number; extra?: Uint8Array; outro?: string; origin?: string; highS?: boolean } = {},
) => {
  const authenticatorData = new Uint8Array([
    ...sha256(utf8(RP_ID)),
    options.flags ?? 0x1d,
    0,
    0,
    0,
    7,
    ...(options.extra ?? []),
  ]);
  const clientDataJSON = utf8(
    `{"type":"webauthn.get","challenge":"${base64Url(passkeyChallenge(hash))}","origin":"${options.origin ?? ORIGIN}"${
      options.outro ?? ',"crossOrigin":false}'
    }`,
  );
  const digest = sha256(new Uint8Array([...authenticatorData, ...sha256(clientDataJSON)]));
  const signed = p256.sign(digest, key.privateKey, { lowS: true });
  const signature = options.highS ? new p256.Signature(signed.r, p256.CURVE.n - signed.s) : signed;
  return { authenticatorData, clientDataJSON, signature: signature.toDERRawBytes() };
};

/**
 * `is_valid_webauthn_signature` of argent-contracts-starknet v0.5.0, rewritten here from the Cairo: read the serialized
 * `SignerSignature::Webauthn`, rebuild the authenticator data and client data from the hash and the signer, and recover
 * the key with the given y parity.
 */
const accountAccepts = (hash: string, felts: string[], expectedX: bigint): boolean => {
  const values = felts.map(BigInt);
  let at = 0;
  const next = () => values[at++]!;
  const span = () => Array.from({ length: Number(next()) }, () => Number(next()));
  const u256 = () => next() + (next() << 128n);
  if (next() !== 4n) return false;
  const origin = new TextDecoder().decode(new Uint8Array(span()));
  const rpIdHash = u256();
  const pubkey = u256();
  const outro = new Uint8Array(span());
  const flags = Number(next());
  const signCount = Number(next());
  const r = u256();
  const s = u256();
  const yParity = Number(next());
  if (at !== values.length || (flags & 0b101) !== 0b101 || s > p256.CURVE.n / 2n || pubkey !== expectedX) return false;
  const rpBytes = Uint8Array.from({ length: 32 }, (_, index) => Number((rpIdHash >> BigInt(8 * (31 - index))) & 0xffn));
  const authenticatorData = new Uint8Array([
    ...rpBytes,
    flags,
    (signCount >>> 24) & 0xff,
    (signCount >>> 16) & 0xff,
    (signCount >>> 8) & 0xff,
    signCount & 0xff,
  ]);
  const json = `{"type":"webauthn.get","challenge":"${base64Url(passkeyChallenge(hash))}","origin":"${origin}"${
    outro.length ? new TextDecoder().decode(outro) : "}"
  }`;
  const digest = sha256(new Uint8Array([...authenticatorData, ...sha256(utf8(json))]));
  const recovered = new p256.Signature(r, s).addRecoveryBit(yParity).recoverPublicKey(digest);
  return recovered.toAffine().x === pubkey;
};

describe("default wallet address", () => {
  it("is Starknet's counterfactual address of the Ready 0.5 class, its constructor and the Realms id", () => {
    const { owner } = passkey();
    const deployment = defaultWalletDeployment(owner, GUARDIAN, REALMS_ID);
    expect(deployment.class_hash).toBe(READY_ACCOUNT_CLASS_HASH);
    expect(BigInt(deployment.salt)).toBe(BigInt(REALMS_ID));
    expect(BigInt(deployment.address)).toBe(
      BigInt(
        starknetHash.calculateContractAddressFromHash(REALMS_ID, READY_ACCOUNT_CLASS_HASH, deployment.calldata, 0),
      ),
    );
  });

  it("serializes Signer::Webauthn(origin, rp id hash, key) then Some(Signer::Starknet(guardian))", () => {
    const owner = { origin: "https://a.b", rpId: "a.b", publicKeyX: "0x1" };
    const rpIdHash = BigInt(`0x${Buffer.from(sha256(utf8("a.b"))).toString("hex")}`);
    expect(defaultWalletCalldata(owner, GUARDIAN).map(BigInt)).toEqual([
      4n,
      11n,
      ...[...utf8("https://a.b")].map(BigInt),
      rpIdHash & ((1n << 128n) - 1n),
      rpIdHash >> 128n,
      1n,
      0n,
      0n,
      0n,
      BigInt(GUARDIAN),
    ]);
  });

  it("differs per Realms id for the same passkey", () => {
    const { owner } = passkey();
    expect(defaultWalletDeployment(owner, GUARDIAN, "0x1").address).not.toBe(
      defaultWalletDeployment(owner, GUARDIAN, "0x2").address,
    );
  });
});

describe("passkey public key", () => {
  it("reads the x of a P-256 SubjectPublicKeyInfo", () => {
    const { point } = passkey();
    const spki = new Uint8Array([
      ...Buffer.from("3059301306072a8648ce3d020106082a8648ce3d030107034200", "hex"),
      ...point.toRawBytes(false),
    ]);
    expect(BigInt(passkeyPublicKeyX(spki))).toBe(point.toAffine().x);
  });

  it("refuses another key type", () => {
    expect(() => passkeyPublicKeyX(new Uint8Array(91))).toThrow(PasskeyAssertionError);
  });
});

describe("passkey owner signature", () => {
  it("is accepted by the account's WebAuthn check, crossOrigin outro and all", () => {
    const key = passkey();
    const felts = passkeyOwnerSignature(key.owner, HASH, assert(key, HASH));
    expect(accountAccepts(HASH, felts, key.point.toAffine().x)).toBe(true);
  });

  it("closes the client data itself when the browser sent nothing after the origin", () => {
    const key = passkey();
    const felts = passkeyOwnerSignature(key.owner, HASH, assert(key, HASH, { outro: "}" }));
    expect(accountAccepts(HASH, felts, key.point.toAffine().x)).toBe(true);
  });

  it("makes a high s low, with the y parity that still recovers the key", () => {
    const key = passkey();
    const felts = passkeyOwnerSignature(key.owner, HASH, assert(key, HASH, { highS: true }));
    expect(accountAccepts(HASH, felts, key.point.toAffine().x)).toBe(true);
  });

  it("is not accepted for another hash", () => {
    const key = passkey();
    const felts = passkeyOwnerSignature(key.owner, HASH, assert(key, HASH));
    expect(accountAccepts("0x1234", felts, key.point.toAffine().x)).toBe(false);
  });

  it.each([
    ["extension data after the sign count", { extra: new Uint8Array([0xa0]) }, "passkey_extension_data"],
    ["a user not verified", { flags: 0x01 }, "passkey_unverified_user"],
    ["another origin", { origin: "https://evil.example" }, "passkey_wrong_client_data"],
    ["client data the account cannot rebuild", { outro: '"x":1}' }, "passkey_wrong_client_data"],
  ])("refuses %s", (_, options, reason) => {
    const key = passkey();
    expect(() => passkeyOwnerSignature(key.owner, HASH, assert(key, HASH, options))).toThrow(reason);
  });

  it("refuses an assertion from another passkey", () => {
    const key = passkey();
    expect(() => passkeyOwnerSignature(passkey().owner, HASH, assert(key, HASH))).toThrow("passkey_wrong_key");
  });
});

describe("default wallet signature", () => {
  it("is the owner's signature, then the guardian's Stark signature, counted as two", () => {
    const signature = ec.starkCurve.sign(HASH, GUARDIAN_KEY);
    const guardian = { publicKey: GUARDIAN, r: `0x${signature.r.toString(16)}`, s: `0x${signature.s.toString(16)}` };
    expect(defaultWalletSignature(["0x4", "0x9"], guardian).map(BigInt)).toEqual([
      2n,
      4n,
      9n,
      0n,
      BigInt(GUARDIAN),
      signature.r,
      signature.s,
    ]);
  });
});

describe("calls match", () => {
  const asked = { contractAddress: "0x124", entrypoint: "transfer", calldata: ["0x5", "100", "0"] };
  const built = {
    to: "0x0124",
    selector: starknetHash.getSelectorFromName("transfer"),
    calldata: ["5", "0x64", "0x0"],
  };

  it("holds for the same targets, selectors and calldata, whatever their felt spelling", () => {
    expect(callsMatch([built], [asked], null)).toBe(true);
  });

  it.each([
    ["another target", [{ ...built, to: "0x125" }]],
    ["another entrypoint", [{ ...built, selector: starknetHash.getSelectorFromName("approve") }]],
    ["other calldata", [{ ...built, calldata: ["0x6", "0x64", "0x0"] }]],
    ["more calldata", [{ ...built, calldata: [...built.calldata, "0x0"] }]],
    ["an extra call", [built, built]],
    ["no call", []],
  ])("fails for %s", (_, calls) => {
    expect(callsMatch(calls, [asked], null)).toBe(false);
  });

  describe("with the wallet paying its own fee", () => {
    const fee = { token: WALLET_GAS_TOKEN, payee: "0xf0", max: 9n * 10n ** 18n };
    const feeCall = (amount: bigint, overrides: Partial<typeof built> = {}) => ({
      to: WALLET_GAS_TOKEN,
      selector: starknetHash.getSelectorFromName("transfer"),
      calldata: ["0xf0", `0x${(amount & ((1n << 128n) - 1n)).toString(16)}`, `0x${(amount >> 128n).toString(16)}`],
      ...overrides,
    });

    it("holds for the asked calls, then one transfer of the fee token to the forwarder within the max", () => {
      expect(callsMatch([built, feeCall(fee.max)], [asked], fee)).toBe(true);
      expect(callsMatch([built, feeCall(1n)], [asked], fee)).toBe(true);
    });

    it.each([
      ["a fee over the max shown", [built, feeCall(fee.max + 1n)]],
      ["a fee whose high word lifts it past the max", [built, feeCall(fee.max + (1n << 128n))]],
      ["a fee paid to another address", [built, feeCall(1n, { calldata: ["0xf1", "0x1", "0x0"] })]],
      [
        "a fee in another token",
        [built, feeCall(1n, { to: "0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d" })],
      ],
      ["a fee by approve", [built, feeCall(1n, { selector: starknetHash.getSelectorFromName("approve") })]],
      ["no fee call", [built]],
      ["the fee before the asked call", [feeCall(1n), built]],
      ["two fee calls", [built, feeCall(1n), feeCall(1n)]],
      ["a call slipped in before the fee", [built, built, feeCall(1n)]],
    ])("fails for %s", (_, calls) => {
      expect(callsMatch(calls, [asked], fee)).toBe(false);
    });

    it("refuses a fee call where a sponsored step allows nothing after its call", () => {
      expect(callsMatch([built, feeCall(1n)], [asked], null)).toBe(false);
    });
  });
});

describe("passkey signer GUID and escape", () => {
  it("is Poseidon over 'Webauthn Signer', the origin bytes, the relying party hash and the key (signer_signature.cairo)", () => {
    const owner = { origin: "https://a.b", rpId: "a.b", publicKeyX: "0x1234" };
    const rpIdHash = BigInt(`0x${Buffer.from(sha256(utf8("a.b"))).toString("hex")}`);
    const low = (value: bigint) => value & ((1n << 128n) - 1n);
    const expected = starknetHash.computePoseidonHashOnElements([
      BigInt(`0x${Buffer.from("Webauthn Signer").toString("hex")}`),
      11n,
      ...[...utf8("https://a.b")].map(BigInt),
      low(rpIdHash),
      rpIdHash >> 128n,
      0x1234n,
      0n,
    ]);
    expect(BigInt(passkeySignerGuid(owner))).toBe(BigInt(expected));
  });

  it("reads an escape's new owner from get_escape_and_status, and none without an escape", () => {
    // Escape { ready_at, escape_type: Owner, new_signer: Some(SignerStorageValue { stored_value, signer_type: 4 }) }, Waiting.
    expect(walletEscapeOf(["0x6a000000", "0x2", "0x0", "0xabc", "0x4", "0x1"])).toEqual({
      status: "waiting",
      readyAt: 0x6a000000,
      newOwner: "0xabc",
    });
    expect(walletEscapeOf(["0x0", "0x0", "0x1", "0x0"])).toEqual({ status: "none", readyAt: null, newOwner: null });
  });
});
