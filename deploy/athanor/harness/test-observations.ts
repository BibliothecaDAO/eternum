import type { SubscriptionTransactionStatusEvent } from "starknet";

export function statusSubscription(status: { finality_status: string; execution_status?: string }) {
  return {
    channel: { websocket: {}, on() {}, off() {} },
    on: (listener: (event: { status: typeof status }) => void) => listener({ status }),
    unsubscribe: async () => true,
  } as unknown as SubscriptionTransactionStatusEvent;
}
