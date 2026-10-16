import environments from "../../../deploy/first/environments.json";

export type Environment = keyof typeof environments;

/**
 * One deployment operates one environment, as every Worker of the deploy does. The Access settings and the operator
 * token are Worker secrets the deploy's setup installs; `ADMIN_ENVIRONMENT` is the wrangler environment's own var.
 */
export interface AdminBindings {
  ASSETS: Fetcher;
  DB: D1Database;
  STATUS: R2Bucket;
  ADMIN_ENVIRONMENT: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  /** Production only: the comma-separated emails who alone may act there (the owner, by default). */
  ADMIN_WRITERS?: string;
  OPERATOR_TOKEN: string;
}

export interface AdminConfig {
  environment: Environment;
  /** The game origin, where the environment's launch service and client answer. */
  origin: string;
  operatorToken: string;
  status: R2Bucket;
  access: { teamDomain: string; audience: string };
  /** Who may act: production's writers, or null on dev, where every operator Access lets in may act. */
  writers: string[] | null;
  /** The other environment's admin page, which the page's environment switch opens. */
  other: { environment: Environment; url: string };
}

const required = (name: keyof AdminBindings, value: unknown): string => {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`Admin is missing ${name}`);
  return value;
};

const environmentOf = (value: unknown): Environment => {
  if (value !== "dev" && value !== "production") throw new Error("Admin is missing ADMIN_ENVIRONMENT");
  return value;
};

/**
 * The Worker's settings, refused whole when one is missing: no call runs on a blank token or audience. Production
 * needs its writers; dev takes none, and a list there is refused rather than ignored.
 */
export const adminConfigOf = (env: AdminBindings): AdminConfig => {
  const environment = environmentOf(env.ADMIN_ENVIRONMENT);
  if (environment === "dev" && env.ADMIN_WRITERS) throw new Error("Dev admin takes no ADMIN_WRITERS");
  const other: Environment = environment === "dev" ? "production" : "dev";
  return {
    environment,
    origin: environments[environment].origin,
    operatorToken: required("OPERATOR_TOKEN", env.OPERATOR_TOKEN),
    status: env.STATUS,
    access: {
      teamDomain: required("ACCESS_TEAM_DOMAIN", env.ACCESS_TEAM_DOMAIN),
      audience: required("ACCESS_AUD", env.ACCESS_AUD),
    },
    writers:
      environment === "production"
        ? required("ADMIN_WRITERS", env.ADMIN_WRITERS)
            .split(",")
            .map((email) => email.trim().toLowerCase())
        : null,
    other: { environment: other, url: environments[other].admin },
  };
};
