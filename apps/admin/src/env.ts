import environments from "../../../deploy/first/environments.json";

export type Environment = "dev" | "production";
export const ENVIRONMENTS: readonly Environment[] = ["dev", "production"];

export interface AdminBindings {
  ASSETS: Fetcher;
  AUDIT: D1Database;
  STATUS_DEV: R2Bucket;
  STATUS_PRODUCTION: R2Bucket;
  ADMIN_HOSTNAME: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  ACCESS_PRODUCTION_AUD: string;
  OPERATOR_TOKEN_DEV: string;
  OPERATOR_TOKEN_PRODUCTION: string;
}

/** One environment the page operates: its game origin (the launch service's), operator token and status record. */
export interface Target {
  environment: Environment;
  origin: string;
  operatorToken: string;
  status: R2Bucket;
}

export interface AdminConfig {
  hostname: string;
  access: { teamDomain: string; audience: string; productionAudience: string };
  targets: Record<Environment, Target>;
}

const required = (name: keyof AdminBindings, value: unknown): string => {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`Admin is missing ${name}`);
  return value;
};

/** The Worker's settings, refused whole when one is missing: no environment runs on a blank token or audience. */
export const adminConfigOf = (env: AdminBindings): AdminConfig => ({
  hostname: required("ADMIN_HOSTNAME", env.ADMIN_HOSTNAME),
  access: {
    teamDomain: required("ACCESS_TEAM_DOMAIN", env.ACCESS_TEAM_DOMAIN),
    audience: required("ACCESS_AUD", env.ACCESS_AUD),
    productionAudience: required("ACCESS_PRODUCTION_AUD", env.ACCESS_PRODUCTION_AUD),
  },
  targets: {
    dev: {
      environment: "dev",
      origin: environments.dev.origin,
      operatorToken: required("OPERATOR_TOKEN_DEV", env.OPERATOR_TOKEN_DEV),
      status: env.STATUS_DEV,
    },
    production: {
      environment: "production",
      origin: environments.production.origin,
      operatorToken: required("OPERATOR_TOKEN_PRODUCTION", env.OPERATOR_TOKEN_PRODUCTION),
      status: env.STATUS_PRODUCTION,
    },
  },
});
