import type { Plugin } from "vite";

/**
 * Build variables the client no longer reads, each with where its value goes now. A retired variable still set in a
 * build environment (a Pages variable, a .env.local) is refused by name, never by value: the one it replaces was a paid
 * RPC key, and a key that sits in a build environment ends up in its logs.
 */
const RETIRED_VARIABLES = {
  VITE_PUBLIC_L2_RPC_URL:
    "the browser reads the public endpoint in packages/chain (PUBLIC_L2_RPC_URL); the paid Alchemy URL belongs only in the Workers' secrets",
} as const;

export const retiredVariableProblem = (env: Record<string, string | undefined>): string | null => {
  const present = Object.keys(RETIRED_VARIABLES).filter((name) => env[name] !== undefined && env[name] !== "");
  if (!present.length) return null;
  return present
    .map(
      (name) =>
        `${name} is retired: ${RETIRED_VARIABLES[name as keyof typeof RETIRED_VARIABLES]}. Remove it from the build environment.`,
    )
    .join("\n");
};

/** Stops the dev server and the build at start, before any file is read or written. */
export const refuseRetiredVariables = (): Plugin => ({
  name: "refuse-retired-variables",
  configResolved(config) {
    const problem = retiredVariableProblem(config.env as Record<string, string | undefined>);
    if (problem) throw new Error(problem);
  },
});
