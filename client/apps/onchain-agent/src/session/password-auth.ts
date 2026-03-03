/**
 * Password-based authentication for Cartridge Controller.
 *
 * Decrypts the owner key from Cartridge's GraphQL API, calls
 * ControllerFactory.login() via WASM, registers a session with
 * specific policies, and writes session.json for SessionProvider.
 */
import "./browser-shims";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ec, stark, hash, encode } from "starknet";
import { ControllerFactory, signerToGuid } from "@cartridge/controller-wasm";

const DEFAULT_CARTRIDGE_API_URL = "https://api.cartridge.gg";
const SESSION_DURATION_SECS = 7 * 24 * 60 * 60; // 7 days

// ---------------------------------------------------------------------------
// Cartridge GraphQL: fetch encrypted private key for a password account
// ---------------------------------------------------------------------------

interface PasswordCredential {
  encryptedPrivateKey: string;
  publicKey: string;
  address: string;
}

async function fetchEncryptedKey(
  username: string,
  apiUrl: string = DEFAULT_CARTRIDGE_API_URL,
): Promise<PasswordCredential> {
  const safeUsername = username.replace(/["\\]/g, "");

  const query = `{
    account(username: "${safeUsername}") {
      controllers {
        edges {
          node {
            address
            signers {
              type
              metadata {
                ... on PasswordCredentials {
                  password { publicKey encryptedPrivateKey }
                }
              }
            }
          }
        }
      }
    }
  }`;

  const res = await fetch(`${apiUrl}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    throw new Error(`Cartridge API error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as any;
  const edges = json?.data?.account?.controllers?.edges;
  if (!edges || edges.length === 0) {
    throw new Error(`No controllers found for username "${username}"`);
  }

  const node = edges[0].node;
  const passwordSigner = node.signers?.find((s: any) => s.type === "password");
  if (!passwordSigner) {
    throw new Error(`No password credential found for "${username}". Only password-based accounts are supported.`);
  }

  const cred = passwordSigner.metadata.password[0];
  if (!cred?.encryptedPrivateKey) {
    throw new Error(`Password credential for "${username}" has no encrypted private key`);
  }

  return {
    encryptedPrivateKey: cred.encryptedPrivateKey,
    publicKey: cred.publicKey,
    address: node.address,
  };
}

// ---------------------------------------------------------------------------
// Decrypt owner private key (PBKDF2 + AES-GCM, same as Cartridge SDK)
// ---------------------------------------------------------------------------

async function decryptOwnerKey(encryptedB64: string, password: string): Promise<string> {
  const encrypted = Buffer.from(encryptedB64, "base64");

  // Layout: salt (16 bytes) | iv (12 bytes) | ciphertext+tag
  const salt = encrypted.slice(0, 16);
  const iv = encrypted.slice(16, 28);
  const ciphertext = encrypted.slice(28);

  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveKey",
  ]);

  const derivedKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );

  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, derivedKey, ciphertext);
  return new TextDecoder().decode(decrypted);
}

// ---------------------------------------------------------------------------
// RPC: fetch controller class hash from chain
// ---------------------------------------------------------------------------

async function getClassHash(rpcUrl: string, address: string): Promise<string> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "starknet_getClassHashAt",
      params: { block_id: "latest", contract_address: address },
    }),
  });

  const json = (await res.json()) as any;
  if (json.error) {
    throw new Error(`Failed to get class hash: ${json.error.message ?? JSON.stringify(json.error)}`);
  }
  return json.result;
}

// ---------------------------------------------------------------------------
// Convert axis SessionPolicies → WASM CallPolicy[]
// ---------------------------------------------------------------------------

type SessionPolicies = {
  contracts: Record<string, { methods: { entrypoint: string }[] }>;
  messages?: unknown[];
};

function policiesToWasm(policies: SessionPolicies): { target: string; method: string }[] {
  const result: { target: string; method: string }[] = [];
  for (const [contractAddr, contract] of Object.entries(policies.contracts)) {
    for (const method of contract.methods) {
      result.push({
        target: contractAddr,
        method: hash.getSelectorFromName(method.entrypoint),
      });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Full password login orchestration
// ---------------------------------------------------------------------------

interface PasswordLoginOptions {
  username: string;
  password: string;
  rpcUrl: string;
  basePath: string;
  policies: SessionPolicies;
  apiUrl?: string;
  expiresInSecs?: number;
}

export async function passwordLogin(options: PasswordLoginOptions): Promise<{ address: string }> {
  const {
    username,
    password,
    rpcUrl,
    basePath,
    policies,
    apiUrl = DEFAULT_CARTRIDGE_API_URL,
    expiresInSecs = SESSION_DURATION_SECS,
  } = options;

  // 1. Fetch and decrypt owner key
  const { encryptedPrivateKey, address, publicKey: ownerPublicKey } = await fetchEncryptedKey(username, apiUrl);
  const ownerPrivateKey = await decryptOwnerKey(encryptedPrivateKey, password);

  // 2. Get controller class hash from chain
  const classHash = await getClassHash(rpcUrl, address);

  // 3. Generate ephemeral session keypair
  const sessionPrivKey = stark.randomAddress();
  const sessionPubKey = ec.starkCurve.getStarkKey(sessionPrivKey);

  // 4. Login via WASM (no wildcard session — we register specific policies)
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + expiresInSecs);
  const loginResult = await ControllerFactory.login(
    username,
    classHash,
    rpcUrl,
    address,
    { signer: { starknet: { privateKey: ownerPrivateKey } } },
    apiUrl,
    expiresAt,
    true, // is_controller_registered
    false, // create_wildcard_session
    null, // app_id
  );

  const accountWithMeta = loginResult.intoValues()[0];
  const account = accountWithMeta.intoAccount();

  // 5. Convert policies and register session
  const wasmPolicies = policiesToWasm(policies);
  await account.registerSession("axis", wasmPolicies, expiresAt, sessionPubKey);

  // 6. Compute guids for session storage
  const formattedOwnerPk = encode.addHexPrefix(ownerPublicKey);
  const formattedSessionPk = encode.addHexPrefix(sessionPubKey);
  const ownerGuid = signerToGuid({ starknet: { privateKey: formattedOwnerPk } });
  const sessionKeyGuid = signerToGuid({ starknet: { privateKey: formattedSessionPk } });

  // 7. Write session.json in NodeBackend format
  mkdirSync(basePath, { recursive: true });
  const sessionData = {
    signer: {
      privKey: sessionPrivKey,
      pubKey: sessionPubKey,
    },
    session: {
      address: address.toLowerCase(),
      ownerGuid: String(ownerGuid).toLowerCase(),
      sessionKeyGuid: String(sessionKeyGuid),
      guardianKeyGuid: "0x0",
      metadataHash: "0x0",
      expiresAt: Number(expiresAt),
    },
  };

  writeFileSync(path.join(basePath, "session.json"), JSON.stringify(sessionData, null, 2));

  return { address };
}
