import { z } from "zod";

import { displayNameSchema, playerIdSchema, starknetAddressSchema, timestampSchema } from "../chat/shared";

export const realtimeSessionTokenPayloadSchema = z.object({
  playerId: playerIdSchema,
  walletAddress: starknetAddressSchema.optional(),
  displayName: displayNameSchema.optional(),
  issuedAt: timestampSchema,
  expiresAt: timestampSchema,
});

export type RealtimeSessionTokenPayload = z.infer<typeof realtimeSessionTokenPayloadSchema>;

type Base64Input = string | Uint8Array;

function encodeBase64Url(input: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  let binary = "";
  for (const byte of input) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4 || 4)) % 4)}`;

  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(padded, "base64"));
  }

  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toBytes(input: Base64Input): Uint8Array {
  return typeof input === "string" ? new TextEncoder().encode(input) : input;
}

function toArrayBuffer(input: Base64Input): ArrayBuffer {
  const bytes = toBytes(input);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", toArrayBuffer(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

async function signValue(secret: string, value: string): Promise<string> {
  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, toArrayBuffer(value));
  return encodeBase64Url(new Uint8Array(signature));
}

function decodeJson<T>(input: string): T {
  const bytes = decodeBase64Url(input);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as T;
}

function encodeJson(input: unknown): string {
  return encodeBase64Url(toBytes(JSON.stringify(input)));
}

export async function signRealtimeSessionToken(payload: RealtimeSessionTokenPayload, secret: string): Promise<string> {
  const validatedPayload = realtimeSessionTokenPayloadSchema.parse(payload);
  const header = encodeJson({ alg: "HS256", typ: "JWT" });
  const body = encodeJson(validatedPayload);
  const unsignedToken = `${header}.${body}`;
  const signature = await signValue(secret, unsignedToken);
  return `${unsignedToken}.${signature}`;
}

export async function verifyRealtimeSessionToken(token: string, secret: string): Promise<RealtimeSessionTokenPayload> {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) {
    throw new Error("Invalid realtime session token.");
  }

  const expectedSignature = await signValue(secret, `${header}.${payload}`);
  if (expectedSignature !== signature) {
    throw new Error("Realtime session token signature mismatch.");
  }

  const decodedPayload = realtimeSessionTokenPayloadSchema.parse(decodeJson<RealtimeSessionTokenPayload>(payload));
  const expiresAt = new Date(decodedPayload.expiresAt).getTime();
  if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
    throw new Error("Realtime session token expired.");
  }

  return decodedPayload;
}
