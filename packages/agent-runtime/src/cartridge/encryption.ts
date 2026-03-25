import type {
  CartridgeEncryptionConfig,
  EncryptedCartridgeSessionMaterial,
  StoredCartridgeSessionMaterial,
} from "../types";

export async function encryptCartridgeSessionMaterial(
  input: StoredCartridgeSessionMaterial,
  config: CartridgeEncryptionConfig,
): Promise<EncryptedCartridgeSessionMaterial> {
  const keyMaterial = requireEncryptionKey(config.keys, config.activeKeyId);
  const key = await importAesKey(keyMaterial, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(input));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(encoded)),
  );

  const authTag = encrypted.slice(encrypted.length - 16);
  const ciphertext = encrypted.slice(0, encrypted.length - 16);

  return {
    keyVersion: config.activeKeyId,
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(ciphertext),
    authTag: encodeBase64(authTag),
  };
}

export async function decryptCartridgeSessionMaterial(
  input: EncryptedCartridgeSessionMaterial,
  config: Pick<CartridgeEncryptionConfig, "keys">,
): Promise<StoredCartridgeSessionMaterial> {
  const keyMaterial = requireEncryptionKey(config.keys, input.keyVersion);
  const key = await importAesKey(keyMaterial, ["decrypt"]);
  const iv = decodeBase64(input.iv);
  const ciphertext = decodeBase64(input.ciphertext);
  const authTag = decodeBase64(input.authTag);
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext, 0);
  combined.set(authTag, ciphertext.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(combined),
  );
  return JSON.parse(new TextDecoder().decode(decrypted)) as StoredCartridgeSessionMaterial;
}

function requireEncryptionKey(keys: Record<string, string>, keyId: string): Uint8Array {
  const encoded = keys[keyId];
  if (!encoded) {
    throw new Error(`Missing encryption key "${keyId}".`);
  }

  return decodeBase64(encoded);
}

async function importAesKey(keyMaterial: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", toArrayBuffer(keyMaterial), "AES-GCM", false, usages);
}

function encodeBase64(input: Uint8Array): string {
  return Buffer.from(input).toString("base64");
}

function decodeBase64(input: string): Uint8Array {
  return new Uint8Array(Buffer.from(input, "base64"));
}

function toArrayBuffer(input: Uint8Array): ArrayBuffer {
  return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;
}
