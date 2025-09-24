import { SqlApi } from "@bibliothecadao/torii";

import type { Config } from "./config.js";
import { ProviderAdapter } from "./adapters/provider-adapter.js";
import { ToriiAdapter } from "./adapters/torii-adapter.js";
import { logger } from "./utils/logger.js";

export interface ServerContext {
  config: Config;
  sqlApi: SqlApi;
  torii: ToriiAdapter;
  provider?: ProviderAdapter;
}

export async function createServerContext(config: Config): Promise<ServerContext> {
  const sqlApi = new SqlApi(config.toriiSqlUrl);
  const torii = new ToriiAdapter(sqlApi);

  let provider: ProviderAdapter | undefined;
  try {
    provider = await ProviderAdapter.createFromConfig(config);
  } catch (error) {
    logger.error({ error }, "Failed to bootstrap provider adapter");
  }

  if (!provider && config.accountAddress) {
    logger.warn("Provider adapter not initialized; transaction tools will be disabled");
  }

  return {
    config,
    sqlApi,
    torii,
    provider,
  };
}
