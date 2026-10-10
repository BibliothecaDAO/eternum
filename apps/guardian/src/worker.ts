import { Effect } from "effect";
import { WorkerEntrypoint } from "cloudflare:workers";

import type { DeviceChange } from "@realms-world/identity/account";

import { createGuardian, type Guardian } from "./guardian";

interface GuardianEnv {
  GUARDIAN_PRIVATE_KEY: string;
}

/**
 * The guardian Worker holds the guardian private key and nothing else. The identity Worker signs through a service binding. A readonly public health route may be attached by the owner,
 * who alone deploys it and sets its key.
 */
export default class GuardianWorker extends WorkerEntrypoint<GuardianEnv> implements Guardian {
  /** Public readiness only; device approvals remain service-binding RPC methods. */
  override fetch(request: Request): Response | Promise<Response> {
    if (request.method !== "GET" || new URL(request.url).pathname !== "/health")
      return new Response(null, { status: 404 });
    return Effect.runPromise(
      Effect.tryPromise({ try: () => this.publicKey(), catch: () => undefined }).pipe(
        Effect.match({
          onSuccess: (publicKey) =>
            Response.json(
              { service: "realms-guardian", success: true, publicKey },
              { headers: { "cache-control": "no-store" } },
            ),
          onFailure: () =>
            Response.json(
              { service: "realms-guardian", success: false },
              { status: 503, headers: { "cache-control": "no-store" } },
            ),
        }),
      ),
    );
  }

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
