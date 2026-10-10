import { Effect, Schema } from "effect";
import { Hono } from "hono";
import type { LaunchAppEnv } from "./auth";

const Target = Schema.Struct({
  chainId: Schema.String.check(Schema.isPattern(/^0x[0-9a-f]+$/i)),
  heraldUrl: Schema.NonEmptyString,
});
const Check = Schema.Struct({
  ...Target.fields,
  name: Schema.String.check(Schema.isPattern(/^check-worker-[0-9a-f]{16}$/)),
  presetId: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 0xffffffff })),
});
export interface OperatorLauncher {
  enrol(input: Schema.Schema.Type<typeof Target>): Promise<{ chainId: string; launcherAccount: string }>;
  check(input: Schema.Schema.Type<typeof Check>): Promise<{ txHash: string }>;
}

/** This surface only enrolls its own signer and creates a reserved proof game. */
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
  app.post(
    "/check",
    handle(Check, (input) => launcher.check(input)),
  );
  return app;
};
