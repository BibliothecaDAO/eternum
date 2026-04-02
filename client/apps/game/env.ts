import { z } from "zod";

import { getSelectedChain } from "./src/runtime/world/store";
import { parseGameEnv } from "./env-parser";

const rawEnv = import.meta.env as Record<string, string | undefined>;

let env: ReturnType<typeof parseGameEnv>;
try {
  env = parseGameEnv(import.meta.env as Record<string, string | undefined>, {
    rawEnv,
    selectedChain: getSelectedChain(),
  });
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("❌ Invalid environment variables:", JSON.stringify(error.errors, null, 2));
  }
  throw new Error("Invalid environment variables");
}

export { env };
export const hasPublicNodeUrl = Boolean(env.VITE_PUBLIC_NODE_URL);
