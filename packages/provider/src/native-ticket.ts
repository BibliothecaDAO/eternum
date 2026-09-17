import { hash } from "starknet";

export interface SignedNativeIntent {
  intent: string[];
  r: string;
  s: string;
  public_key: string;
}

/** Follow one signed action to its retained transaction; retries never sign or admit a new action. */
export function createNativeTicketSubmission(
  baseUrl: string,
): (signed: SignedNativeIntent) => Promise<{ transaction_hash: string; order: bigint }> {
  const actionsUrl = `${baseUrl.replace(/\/$/, "")}/actions`;
  return async (signed) => {
    const action = hash.computePoseidonHashOnElements(signed.intent);
    const signal = AbortSignal.timeout(120_000);
    const response = await admitSignedAction(actionsUrl, signed, signal);
    const accepted = await response.json();
    if (typeof accepted.action !== "string" || BigInt(accepted.action) !== BigInt(action))
      throw new Error("Admission returned a different action identity");
    const order = readTicketOrder(accepted.order);
    try {
      while (true) {
        signal.throwIfAborted();
        const statusResponse = await fetch(`${actionsUrl}/${action}`, { signal });
        if (!statusResponse.ok && statusResponse.status !== 503)
          throw new Error(`Ticket status unavailable (${statusResponse.status})`);
        if (statusResponse.ok) {
          const status = await statusResponse.json();
          if (
            typeof status.action !== "string" ||
            BigInt(status.action) !== BigInt(action) ||
            readTicketOrder(status.order) !== order
          )
            throw new Error("Ticket status identity mismatch");
          if (status.transaction_hash !== null) {
            if (typeof status.transaction_hash !== "string" || !/^0x[0-9a-f]+$/i.test(status.transaction_hash))
              throw new Error("Invalid ticket transaction hash");
            return { transaction_hash: status.transaction_hash, order };
          }
        }
        if (!statusResponse.ok) await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    } catch (cause) {
      throw new Error(
        `Action ${action} was accepted at order ${order}; tracking stopped. Do not submit a replacement.`,
        { cause },
      );
    }
  };
}

async function admitSignedAction(url: string, signed: SignedNativeIntent, signal: AbortSignal): Promise<Response> {
  const body = JSON.stringify(signed);
  while (true) {
    signal.throwIfAborted();
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal,
    });
    if (response.ok) return response;
    if (response.status !== 503) throw new Error(`Action admission rejected (${response.status})`);
    // Backpressure can outlast an HTTP request. Retry the same signed identity, never a new ticket.
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function readTicketOrder(value: unknown): bigint {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new Error("Invalid ticket order");
  return BigInt(value);
}
