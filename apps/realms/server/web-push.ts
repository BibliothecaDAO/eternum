import { buildPushPayload } from "@block65/webcrypto-web-push";
import type { PushEnvelope } from "@bibliothecadao/notifications";

interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

interface PushDevice {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** What the push service did with one message: kept it, forgot the device, asked to retry, or refused it. */
type PushOutcome = "accepted" | "expired" | "retry" | "rejected";

/** A game alert is worth delivering only while its notification is; it expires two minutes after the event. */
const PUSH_TTL_SECONDS = 120;

/** Encrypts the envelope for the device (RFC 8291), signs it with our VAPID key (RFC 8292) and hands it over. */
export const sendPush = async (
  vapid: VapidKeys,
  device: PushDevice,
  envelope: PushEnvelope,
  fetchPush: typeof fetch = fetch,
): Promise<PushOutcome> => {
  const message = await buildPushPayload(
    { data: envelope as never, options: { ttl: PUSH_TTL_SECONDS, urgency: "high" } },
    { endpoint: device.endpoint, expirationTime: null, keys: { p256dh: device.p256dh, auth: device.auth } },
    vapid,
  );
  const response = await fetchPush(device.endpoint, {
    method: message.method,
    headers: message.headers,
    body: message.body,
    redirect: "manual",
  });
  if (response.ok) return "accepted";
  if (response.status === 404 || response.status === 410) return "expired";
  if (response.status === 429 || response.status >= 500) return "retry";
  return "rejected";
};
