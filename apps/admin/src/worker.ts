import { adminApp } from "./app";
import { AuditLog } from "./audit";
import { adminConfigOf, type AdminBindings } from "./env";

export default {
  fetch(request: Request, env: AdminBindings): Promise<Response> | Response {
    if (!new URL(request.url).pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    return adminApp({
      config: adminConfigOf(env),
      audit: new AuditLog(env.DB),
      send: (input, init) => fetch(input, init),
      now: () => Date.now(),
    }).fetch(request);
  },
} satisfies ExportedHandler<AdminBindings>;
