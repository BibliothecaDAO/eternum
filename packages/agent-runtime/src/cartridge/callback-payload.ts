import { encode } from "starknet";
import { createHash } from "node:crypto";

import type { CartridgeSessionRegistration, CartridgeSigner } from "../types";

export function normalizeCartridgeCallbackPayload(input: {
  startapp: string;
  signer: CartridgeSigner;
}): CartridgeSessionRegistration {
  const parsed = JSON.parse(decodeBase64(input.startapp)) as CartridgeSessionRegistration;
  const formattedPubKey = encode.addHexPrefix(input.signer.pubKey);

  return {
    ...parsed,
    address: parsed.address.toLowerCase(),
    ownerGuid: parsed.ownerGuid.toLowerCase(),
    guardianKeyGuid: "0x0",
    metadataHash: "0x0",
    sessionKeyGuid: deriveSessionKeyGuid(formattedPubKey),
  };
}

function decodeBase64(value: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "base64").toString("utf8");
  }

  return atob(value);
}

function deriveSessionKeyGuid(publicKey: string): string {
  return `0x${createHash("sha256").update(publicKey).digest("hex")}`;
}
