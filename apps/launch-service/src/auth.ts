import { presentsOperatorToken } from "@realms-world/identity";
import type { MiddlewareHandler } from "hono";

/** Public discovery is read-only; every mutation belongs to the environment's operator. */
export const requireOperator =
  (token: string): MiddlewareHandler =>
  async (context, next) => {
    if (
      context.req.method !== "GET" &&
      context.req.method !== "OPTIONS" &&
      !(await presentsOperatorToken(context.req.raw, token))
    )
      return context.json({ error: "Operator token required." }, 403);
    await next();
  };
