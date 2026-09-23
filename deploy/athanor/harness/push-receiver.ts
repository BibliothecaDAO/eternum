/**
 * A web push receiver that stands in for a browser: it registers with Mozilla's push service over the WebSocket
 * protocol Firefox uses, subscribes with its own keys, and decrypts each push it is sent (RFC 8291, aes128gcm). The
 * identity Worker's alerts then travel the real path, through a real push service, to something a script can read.
 *
 *   bun deploy/athanor/harness/push-receiver.ts <vapid public key>
 *
 * prints the subscription as JSON on its first line, then one JSON line per push it receives.
 */

const PUSH_SERVICE = "wss://push.services.mozilla.com/";

interface PushSubscriptionKeys {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface ReceivedPush {
  receivedAt: number;
  payload: unknown;
}

const base64url = {
  encode: (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url"),
  decode: (text: string) => new Uint8Array(Buffer.from(text, "base64url")),
};

/** The receiving side's keys: an ECDH P-256 pair and a 16-byte authentication secret, as a browser makes them. */
async function createReceiverKeys() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  return {
    privateKey: pair.privateKey,
    publicKey: new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)),
    authSecret: crypto.getRandomValues(new Uint8Array(16)),
  };
}

type ReceiverKeys = Awaited<ReturnType<typeof createReceiverKeys>>;

/** Bytes WebCrypto accepts: backed by a plain ArrayBuffer, as every slice and encoding below is. */
type Bytes = Uint8Array<ArrayBuffer>;

const hkdf = async (salt: Bytes, secret: Bytes, info: Bytes, length: number) => {
  const key = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
};

const concat = (...parts: Bytes[]) => {
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
};

const text = (value: string) => new TextEncoder().encode(value);

/** Decrypts one aes128gcm push body (RFC 8188 framing, RFC 8291 keys) with the receiver's keys. */
export async function decryptPush(body: Uint8Array, keys: ReceiverKeys): Promise<Uint8Array> {
  const salt = body.slice(0, 16);
  const recordSize = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0);
  const keyIdLength = body[20]!;
  const senderPublicKey = body.slice(21, 21 + keyIdLength);
  const ciphertext = body.slice(21 + keyIdLength);
  if (ciphertext.length > recordSize) throw new Error("A push body of more than one record is not supported");

  const sender = await crypto.subtle.importKey("raw", senderPublicKey, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: sender }, keys.privateKey, 256),
  );
  const ikm = await hkdf(
    keys.authSecret,
    shared,
    concat(text("WebPush: info\0"), keys.publicKey, senderPublicKey),
    32,
  );
  const contentKey = await hkdf(salt, ikm, text("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, text("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", contentKey, "AES-GCM", false, ["decrypt"]);
  const padded = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aes, ciphertext));
  // The last record ends with the delimiter 0x02 followed by optional zero padding.
  let end = padded.length - 1;
  while (end >= 0 && padded[end] === 0) end--;
  if (padded[end] !== 2) throw new Error("Push record has no final-record delimiter");
  return padded.slice(0, end);
}

/**
 * Registers with the push service for one application server key and calls `onPush` for each push, decrypted and
 * acknowledged. Resolves with the subscription to give the identity Worker.
 */
export async function receivePushes(
  applicationServerKey: string,
  onPush: (push: ReceivedPush) => void,
): Promise<{ subscription: PushSubscriptionKeys; close: () => void }> {
  const keys = await createReceiverKeys();
  const socket = new WebSocket(PUSH_SERVICE);
  const channelID = crypto.randomUUID();
  const endpoint = await new Promise<string>((resolve, reject) => {
    socket.addEventListener("open", () =>
      socket.send(JSON.stringify({ messageType: "hello", use_webpush: true, uaid: "" })),
    );
    socket.addEventListener("error", () => reject(new Error("Push service connection failed")));
    socket.addEventListener("message", async (event) => {
      const message = JSON.parse(String(event.data));
      if (message.messageType === "hello") {
        socket.send(JSON.stringify({ messageType: "register", channelID, key: applicationServerKey }));
      } else if (message.messageType === "register") {
        if (message.status !== 200) reject(new Error(`Push service refused registration: ${message.status}`));
        else resolve(message.pushEndpoint);
      } else if (message.messageType === "notification") {
        socket.send(
          JSON.stringify({ messageType: "ack", updates: [{ channelID: message.channelID, version: message.version }] }),
        );
        const payload = message.data
          ? JSON.parse(new TextDecoder().decode(await decryptPush(base64url.decode(message.data), keys)))
          : null;
        onPush({ receivedAt: Date.now(), payload });
      }
    });
  });
  return {
    subscription: { endpoint, keys: { p256dh: base64url.encode(keys.publicKey), auth: base64url.encode(keys.authSecret) } },
    close: () => socket.close(),
  };
}

if (import.meta.main) {
  const applicationServerKey = process.argv[2];
  if (!applicationServerKey) throw new Error("usage: bun push-receiver.ts <vapid public key>");
  const { subscription } = await receivePushes(applicationServerKey, (push) => console.log(JSON.stringify(push)));
  console.log(JSON.stringify(subscription));
}
