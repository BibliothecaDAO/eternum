import type { EternumClientConfig } from "./config";
import { ViewClient, type SqlApiLike } from "./views";

/**
 * Main entry point for the headless Eternum client.
 */
export class EternumClient {
  readonly view: ViewClient;

  private _sql: SqlApiLike;

  private constructor(config: EternumClientConfig, sql: SqlApiLike) {
    this._sql = sql;
    this.view = new ViewClient(this._sql, config.logger);
  }

  static async create(config: EternumClientConfig): Promise<EternumClient> {
    const toriiMod = await import("@bibliothecadao/torii" as string);
    const sqlUrl = config.toriiUrl.endsWith("/sql") ? config.toriiUrl : `${config.toriiUrl}/sql`;
    const sql = new toriiMod.SqlApi(sqlUrl, config.cacheUrl);
    return new EternumClient(config, sql);
  }

  get sql(): SqlApiLike {
    return this._sql;
  }
}
