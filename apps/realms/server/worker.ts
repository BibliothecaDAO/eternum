import { Schema } from "effect";

/**
 * The identity Worker, served under /api. Its environment is decoded on every request, so a misconfigured
 * deployment fails loudly on its first call instead of answering with defaults.
 */
const WorkerEnv = Schema.Struct({
  ENVIRONMENT: Schema.Literals(["staging", "production"]),
});

const decodeWorkerEnv = Schema.decodeUnknownSync(WorkerEnv, { onExcessProperty: "ignore" });

const json = (body: unknown, status = 200): Response => Response.json(body, { status });

export default {
  fetch(request: Request, rawEnv: unknown): Response {
    const env = decodeWorkerEnv(rawEnv);
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({ service: "realms-identity", environment: env.ENVIRONMENT });
    }
    return json({ error: "not_found" }, 404);
  },
};
