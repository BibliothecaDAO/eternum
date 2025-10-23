import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth";
export declare const directMessageRoutes: Hono<AppEnv, import("hono/types").BlankSchema, "/">;
export declare function buildThreadId(playerA: string, playerB: string): string;
export declare function sortParticipants(playerA: string, playerB: string): [string, string];
export default directMessageRoutes;
