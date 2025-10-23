import type { MiddlewareHandler } from "hono";
export interface PlayerSession {
    playerId: string;
    walletAddress?: string;
    displayName?: string;
    aliases: string[];
}
export type AppEnv = {
    Variables: {
        playerSession?: PlayerSession;
    };
};
export declare const attachPlayerSession: MiddlewareHandler<AppEnv>;
export declare const requirePlayerSession: MiddlewareHandler<AppEnv>;
