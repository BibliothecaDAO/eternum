import { Hono, type Context } from "hono";
import { GAME_ENVIRONMENTS } from "@bibliothecadao/launch-service/operator-api";
import { AccessDenied, verifyAccess, type AccessIdentity } from "./access";
import type { AuditLog } from "./audit";
import { ENVIRONMENTS, type AdminConfig, type Environment } from "./env";
import { LaunchService } from "./launch";
import { deploysView, gamesView } from "./views";

interface AdminDependencies {
  config: AdminConfig;
  audit: AuditLog;
  send: typeof fetch;
  now: () => number;
}

type AdminContext = Context<{ Variables: { identity: AccessIdentity } }>;

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

const ACTIONS: Record<string, Action> = {
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

const environmentOf = (value: string | undefined): Environment | null =>
  ENVIRONMENTS.find((environment) => environment === value) ?? null;

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
  const launchOf = (environment: Environment) => new LaunchService(config.targets[environment], send);

  // Every API call proves its Access identity: production paths against the production application, the rest
  // against the page's own.
  app.use("/api/*", async (context, next) => {
    const production = context.req.path.startsWith("/api/production/");
    const audience = production ? config.access.productionAudience : config.access.audience;
    try {
      const identity = await verifyAccess(
        context.req.header("cf-access-jwt-assertion") ?? null,
        { teamDomain: config.access.teamDomain, audience },
        send,
        now(),
      );
      context.set("identity", identity);
    } catch (error) {
      if (error instanceof AccessDenied) return context.json({ error: error.message }, 403);
      throw error;
    }
    await next();
  });

  app.notFound((context) => context.json({ error: "Not Found" }, 404));

  app.get("/api/audit", async (context) => context.json({ actions: await audit.latest(100) }));

  app.get("/api/:environment/session", (context) => {
    if (!environmentOf(context.req.param("environment"))) return context.notFound();
    return context.json({ email: context.get("identity").email });
  });

  app.get("/api/:environment/games", async (context) => {
    const environment = environmentOf(context.req.param("environment"));
    if (!environment) return context.notFound();
    return context.json(await gamesView(config.targets[environment], launchOf(environment)));
  });

  app.get("/api/:environment/deploys", async (context) => {
    const environment = environmentOf(context.req.param("environment"));
    if (!environment) return context.notFound();
    return context.json(await deploysView(config.targets[environment], launchOf(environment), send));
  });

  const write = (name: keyof typeof ACTIONS) => async (context: AdminContext) => {
    const environment = environmentOf(context.req.param("environment"));
    const action = ACTIONS[name]!;
    const route = action.route(context.req.param());
    if (!environment || !route || (action.devOnly && environment !== "dev")) return context.notFound();
    let body: string | null;
    try {
      body = await readBody(context, action.carriesBody);
    } catch (error) {
      return context.json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
    const id = await audit.sent(
      {
        email: context.get("identity").email,
        environment,
        action: route.action,
        request: JSON.stringify({ method: action.method, path: route.path, body: body && JSON.parse(body) }),
      },
      now(),
    );
    try {
      const answer = await launchOf(environment).write(action.method, route.path, body);
      await audit.answered(id, answer.status, answer.body);
      return new Response(answer.body, { status: answer.status, headers: { "content-type": "application/json" } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await audit.failed(id, message);
      return context.json({ error: message }, 502);
    }
  };

  app.post("/api/:environment/test-blitz", write("test-blitz"));
  app.post("/api/:environment/slots", write("open-slot"));
  app.post("/api/:environment/slots/:name/refund", write("refund-slot"));
  app.put("/api/:environment/calendar/:phase", write("set-phase"));
  app.post("/api/:environment/:kind/:game/:name/:verb", write("run-action"));

  return app;
};
