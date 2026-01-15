import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "./auth";

interface RateLimitStore {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitStore>();

const RATE_LIMIT_WINDOW = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_GENERATIONS_PER_WEEK =
  Number(process.env.AVATAR_MAX_GENERATIONS_PER_WEEK) ||
  Number(process.env.AVATAR_MAX_GENERATIONS_PER_DAY) ||
  1;

export const avatarRateLimit: MiddlewareHandler<AppEnv> = async (c, next) => {
  const session = c.get("playerSession");

  if (!session || !session.displayName) {
    return c.json({ error: "Authentication required for avatar generation" }, 401);
  }

  const key = `avatar:${session.displayName}`;
  const now = Date.now();

  let limitInfo = rateLimitStore.get(key);

  if (!limitInfo || now >= limitInfo.resetAt) {
    limitInfo = {
      count: 0,
      resetAt: now + RATE_LIMIT_WINDOW,
    };
    rateLimitStore.set(key, limitInfo);
  }

  if (limitInfo.count >= MAX_GENERATIONS_PER_WEEK) {
    const resetIn = Math.ceil((limitInfo.resetAt - now) / 1000 / 60 / 60 / 24);
    return c.json(
      {
        error: "Rate limit exceeded",
        message: `You have reached the maximum of ${MAX_GENERATIONS_PER_WEEK} avatar generations per week`,
        resetInDays: resetIn,
      },
      429,
    );
  }

  await next();
};

export function incrementRateLimit(username: string): void {
  const key = `avatar:${username}`;
  const limitInfo = rateLimitStore.get(key);

  if (limitInfo) {
    limitInfo.count += 1;
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [key, limitInfo] of rateLimitStore.entries()) {
    if (now >= limitInfo.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 60 * 1000);
