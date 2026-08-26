import type { IdentityChainId } from "./types";

/**
 * Sign-In-With-Starknet typed data, built to canonical SNIP-12 revision 1.
 *
 * Controller's account-wasm parses the type definitions strictly: under revision 1 the
 * `StarknetDomain` members must be `shortstring` ("string" is the revision-1 long-string
 * object type there, and the previous @realms-world/siws definitions were rejected with
 * "invalid domain type definition for revision 1"). The client builds this message and the
 * server re-parses it with `parseSiwsTypedData`, which refuses any deviation from these
 * exact types — the signature must cover the message we think it covers.
 */

export const SIWS_TYPES = {
  StarknetDomain: [
    { name: "name", type: "shortstring" },
    { name: "version", type: "shortstring" },
    { name: "chainId", type: "shortstring" },
    { name: "revision", type: "shortstring" },
  ],
  Message: [
    { name: "address", type: "ContractAddress" },
    { name: "statement", type: "string" },
    { name: "uri", type: "string" },
    { name: "nonce", type: "string" },
    { name: "issuedAt", type: "shortstring" },
    { name: "version", type: "shortstring" },
  ],
} as const;

const SIWS_DOMAIN_VERSION = "0.0.1";
const SIWS_MESSAGE_VERSION = "0.0.5";
const SHORT_STRING_MAX_LENGTH = 31;

export interface SiwsDomain {
  name: string;
  version: string;
  chainId: string;
  revision: string;
}

export interface SiwsMessageFields {
  address: string;
  statement: string;
  uri: string;
  nonce: string;
  issuedAt: string;
  version: string;
}

export interface SiwsTypedData {
  types: typeof SIWS_TYPES;
  primaryType: "Message";
  domain: SiwsDomain;
  message: SiwsMessageFields;
}

export interface BuildSiwsMessageOptions {
  address: string;
  chainId: IdentityChainId;
  domain: string;
  nonce: string;
  statement?: string;
  uri: string;
  issuedAt?: string;
}

export const buildSiwsMessage = ({
  address,
  chainId,
  domain,
  nonce,
  statement = "Login to Realms.World with your Starknet wallet",
  uri,
  issuedAt = new Date().toISOString(),
}: BuildSiwsMessageOptions): SiwsTypedData => {
  const typedData: SiwsTypedData = {
    types: SIWS_TYPES,
    primaryType: "Message",
    domain: { name: domain, version: SIWS_DOMAIN_VERSION, chainId, revision: "1" },
    message: { address, statement, uri, nonce, issuedAt, version: SIWS_MESSAGE_VERSION },
  };
  assertSiwsTypedData(typedData);
  return typedData;
};

/** Parses and strictly validates a serialized SIWS message; throws on any deviation. */
export const parseSiwsTypedData = (json: string): SiwsTypedData => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("SIWS message is not valid JSON");
  }
  assertSiwsTypedData(parsed);
  return parsed;
};

function assertSiwsTypedData(value: unknown): asserts value is SiwsTypedData {
  if (typeof value !== "object" || value === null) throw new Error("SIWS message must be an object");
  const candidate = value as Record<string, unknown>;
  if (candidate.primaryType !== "Message") throw new Error("SIWS primaryType must be Message");
  if (JSON.stringify(candidate.types) !== JSON.stringify(SIWS_TYPES)) {
    throw new Error("SIWS type definitions do not match the canonical revision 1 types");
  }
  const domain = requireStringFields(candidate.domain, ["name", "version", "chainId", "revision"], "domain");
  for (const [field, fieldValue] of Object.entries(domain)) assertShortString(`domain.${field}`, fieldValue);
  const message = requireStringFields(
    candidate.message,
    ["address", "statement", "uri", "nonce", "issuedAt", "version"],
    "message",
  );
  assertShortString("message.issuedAt", message.issuedAt);
  assertShortString("message.version", message.version);
  if (domain.revision !== "1") throw new Error("SIWS domain revision must be 1");
}

function requireStringFields<K extends string>(value: unknown, fields: readonly K[], label: string): Record<K, string> {
  if (typeof value !== "object" || value === null) throw new Error(`SIWS ${label} must be an object`);
  const record = value as Record<string, unknown>;
  const known = new Set<string>(fields);
  for (const key of Object.keys(record)) {
    if (!known.has(key)) throw new Error(`SIWS ${label}.${key} is not part of the message`);
  }
  const result = {} as Record<K, string>;
  for (const field of fields) {
    const fieldValue = record[field];
    if (typeof fieldValue !== "string" || fieldValue.length === 0) {
      throw new Error(`SIWS ${label}.${field} must be a non-empty string`);
    }
    result[field] = fieldValue;
  }
  return result;
}

function assertShortString(label: string, value: string) {
  if (value.length > SHORT_STRING_MAX_LENGTH) {
    throw new Error(`SIWS ${label} must fit a Cairo shortstring (31 characters), got ${value.length}`);
  }
}
