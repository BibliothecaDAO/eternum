import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth";
export declare const notesRoutes: Hono<AppEnv, import("hono/types").BlankSchema, "/">;
export default notesRoutes;
