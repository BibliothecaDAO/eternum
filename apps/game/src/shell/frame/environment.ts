/**
 * The environment a build serves, from the one build constant deploy-client.yml sets per GitHub environment
 * (VITE_PUBLIC_ENVIRONMENT), never from the hostname. Anything but production is the dev environment, so a build that
 * lost the constant wears the Dev mark rather than passing for production.
 */
export const isDevEnvironment = (buildConstant: string | undefined): boolean => buildConstant !== "production";

/** The deployed environment a build serves, by the same rule: production, or staging for every dev build. */
export const valueEnvironmentOf = (buildConstant: string | undefined) =>
  isDevEnvironment(buildConstant) ? ("staging" as const) : ("production" as const);

// The build config imports this file too, where import.meta.env does not exist.
export const IS_DEV_ENVIRONMENT = isDevEnvironment(import.meta.env?.VITE_PUBLIC_ENVIRONMENT);
