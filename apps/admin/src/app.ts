import { Hono, type Context } from "hono";
import { GAME_ENVIRONMENTS } from "@bibliothecadao/launch-service/operator-api";
import { AccessDenied, verifyAccess, type AccessIdentity } from "./access";
import type { AuditLog } from "./audit";
import type { AdminConfig } from "./env";
import { LaunchService } from "./launch";
import { deploysView, gamesView } from "./views";

interface AdminDependencies {
  config: AdminConfig;
  audit: AuditLog;
  send: typeof fetch;
  now: () => number;
}

type AdminContext = Context<{ Variables: { identity: AccessIdentity } }>;

/** Every write lives under this path. */
const ACTIONS = "/api/actions/";
const BODY_LIMIT = 16_000;
const NAME = /^[a-z0-9-]{1,64}$/;

/** One write the page may send: the launch route it calls and how the audit names it. */
interface Action {
  method: "POST" | "PUT";
  devOnly?: boolean;
  carriesBody: boolean;
  route: (params: Record<string, string>) => { path: string; action: string } | null;
}

const isGameEnvironment = (value: string | undefined) => GAME_ENVIRONMENTS.some((id) => id === value);
const named = (value: string | undefined): value is string => value !== undefined && NAME.test(value);

const WRITES: Record<string, Action> = {
  "test-blitz": {
    method: "POST",
    devOnly: true,
    carriesBody: true,
    route: () => ({ path: "/api/factory/test-blitz", action: "Free test Blitz" }),
  },
  "open-slot": {
    method: "POST",
    carriesBody: true,
    route: () => ({ path: "/api/slots", action: "Open Blitz slot" }),
  },
  "refund-slot": {
    method: "POST",
    carriesBody: false,
    route: ({ name }) => (named(name) ? { path: `/api/slots/${name}/refund`, action: `Refund slot ${name}` } : null),
  },
  "set-phase": {
    method: "PUT",
    carriesBody: true,
    route: ({ phase }) =>
      phase === "frontier" || phase === "blitz"
        ? { path: `/api/factory/calendar/${phase}`, action: `Set ${phase} phase` }
        : null,
  },
  "run-action": {
    method: "POST",
    carriesBody: false,
    route: ({ kind, game, name, verb }) =>
      isGameEnvironment(game) &&
      named(name) &&
      ((kind === "runs" && (verb === "continue" || verb === "delete")) || (kind === "results" && verb === "continue"))
        ? { path: `/api/factory/${kind}/${game}/${name}/actions/${verb}`, action: `${verb} ${kind} ${name}` }
        : null,
  },
};

/** A request's body as the launch service will read it: absent, or one JSON object within the limit. */
const readBody = async (context: AdminContext, carriesBody: boolean): Promise<string | null> => {
  if (!carriesBody) return null;
  const text = await context.req.text();
  if (text.length > BODY_LIMIT) throw new Error("Request body is too large");
  const value: unknown = JSON.parse(text);
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("Request body must be an object");
  return text;
};

export const adminApp = ({ config, audit, send, now }: AdminDependencies) => {
  const app = new Hono<{ Variables: { identity: AccessIdentity } }>();
  const launch = new LaunchService(config, send);

  // Every API call proves its Access identity; on production, a write also needs its sender among the writers.
  app.use("/api/*", async (context, next) => {
    try {
      const identity = await verifyAccess(
        context.req.header("cf-access-jwt-assertion") ?? null,
        config.access,
        send,
        now(),
      );
      if (
        context.req.path.startsWith(ACTIONS) &&
        config.writers &&
        !config.writers.includes(identity.email.toLowerCase())
      )
        throw new AccessDenied("Production actions are open to the owner's list only");
      context.set("identity", identity);
    } catch (error) {
      if (error instanceof AccessDenied) return context.json({ error: error.message }, 403);
      throw error;
    }
    await next();
  });
  app.notFound((context) => context.json({ error: "Not Found" }, 404));

  app.get("/api/session", (context) =>
    context.json({ email: context.get("identity").email, environment: config.environment, other: config.other }),
  );
  app.get("/api/games", async (context) => context.json(await gamesView(config, launch)));
  app.get("/api/deploys", async (context) => context.json(await deploysView(config, launch, send)));
  app.get("/api/audit", async (context) => context.json({ actions: await audit.latest(100) }));

  const write = (name: keyof typeof WRITES) => async (context: AdminContext) => {
    const action = WRITES[name]!;
    const route = action.route(context.req.param());
    if (!route || (action.devOnly && config.environment !== "dev")) return context.notFound();
    let body: string | null;
    try {
      body = await readBody(context, action.carriesBody);
    } catch (error) {
      return context.json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
    const id = await audit.sent(
      {
        email: context.get("identity").email,
        environment: config.environment,
        action: route.action,
        request: JSON.stringify({ method: action.method, path: route.path, body: body && JSON.parse(body) }),
      },
      now(),
    );
    try {
      const answer = await launch.write(action.method, route.path, body);
      await audit.answered(id, answer.status, answer.body);
      return new Response(answer.body, { status: answer.status, headers: { "content-type": "application/json" } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await audit.failed(id, message);
      return context.json({ error: message }, 502);
    }
  };

  app.post(`${ACTIONS}test-blitz`, write("test-blitz"));
  app.post(`${ACTIONS}slots`, write("open-slot"));
  app.post(`${ACTIONS}slots/:name/refund`, write("refund-slot"));
  app.put(`${ACTIONS}calendar/:phase`, write("set-phase"));
  app.post(`${ACTIONS}:kind/:game/:name/:verb`, write("run-action"));

  return app;
};
