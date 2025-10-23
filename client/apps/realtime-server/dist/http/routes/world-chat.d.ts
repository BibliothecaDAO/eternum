import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth";
export declare const worldChatRoutes: Hono<AppEnv, import("hono/types").BlankSchema, "/">;
export default worldChatRoutes;
