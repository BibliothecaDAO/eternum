import pg from "pg";

const { Pool } = pg;

const DEFAULT_PREVIEW_CONNECTION_STRING = "postgresql://postgres:postgres@127.0.0.1:54329/ammv2_preview";

export function createAmmV2DatabasePool(connectionString: string) {
  return new Pool({ connectionString });
}

export function resolveAmmV2DatabaseConnectionString(rawValue: string | undefined): string {
  const connectionString = rawValue?.trim();

  if (!connectionString) {
    throw new Error("POSTGRES_CONNECTION_STRING must be set");
  }

  return connectionString;
}

export function resolveAmmV2PreviewDatabaseConnectionString(rawValue: string | undefined): string {
  const connectionString = rawValue?.trim();
  return connectionString && connectionString.length > 0 ? connectionString : DEFAULT_PREVIEW_CONNECTION_STRING;
}
