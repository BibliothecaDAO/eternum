import { WorkerEntrypoint } from "cloudflare:workers";

import { createGuardian, type DeviceChange, type Guardian } from "./guardian";

interface GuardianEnv {
  GUARDIAN_PRIVATE_KEY: string;
}

/**
 * The guardian Worker holds the guardian private key and nothing else. It has no route and no workers.dev address:
 * the identity Worker reaches it through a service binding, and only the owner deploys it and sets its key.
 */
export default class GuardianWorker extends WorkerEntrypoint<GuardianEnv> implements Guardian {
  publicKey() {
    return this.guardian().publicKey();
  }

  signDeviceChange(change: DeviceChange) {
    return this.guardian().signDeviceChange(change);
  }

  private guardian() {
    if (!/^0x[0-9a-fA-F]{1,64}$/.test(this.env.GUARDIAN_PRIVATE_KEY ?? "")) {
      throw new Error("GUARDIAN_PRIVATE_KEY is not set to a hex private key");
    }
    return createGuardian(this.env.GUARDIAN_PRIVATE_KEY);
  }
}
