import { Effect, Schema } from "effect";
import { Hono } from "hono";
import type { LaunchAppEnv } from "./auth";

const Target = Schema.Struct({
  chainId: Schema.String.check(Schema.isPattern(/^0x[0-9a-f]+$/i)),
  heraldUrl: Schema.NonEmptyString,
});
export interface OperatorLauncher {
  enrol(input: Schema.Schema.Type<typeof Target>): Promise<{ chainId: string; launcherAccount: string }>;
}

/** This surface only enrolls its own signer. */
export const launcherOperatorRoutes = (launcher: OperatorLauncher) => {
  const app = new Hono<LaunchAppEnv>();
  app.use("*", async (context, next) => {
    if (context.get("caller")?.kind !== "operator") return context.json({ error: "Operator token required." }, 403);
    return next();
  });
  const handle =
    <A>(schema: Schema.ConstraintDecoder<A, never>, run: (input: A) => Promise<unknown>) =>
    async (context: import("hono").Context) => {
      let input: A;
      try {
        input = await Effect.runPromise(
          Schema.decodeUnknownEffect(schema, { onExcessProperty: "error" })(await context.req.json()),
        );
      } catch {
        return context.json({ error: "invalid_launcher_request" }, 400);
      }
      try {
        return context.json((await run(input)) as object);
      } catch {
        return context.json({ error: "launcher_deployment_unavailable" }, 409);
      }
    };
  app.post(
    "/enrol",
    handle(Target, (input) => launcher.enrol(input)),
  );
  return app;
};
