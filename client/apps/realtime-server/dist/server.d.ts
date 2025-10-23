import "dotenv/config";
import { Hono } from "hono";
import { type AppEnv } from "./http/middleware/auth";
declare const app: Hono<AppEnv, import("hono/types").BlankSchema, "/">;
export default app;
