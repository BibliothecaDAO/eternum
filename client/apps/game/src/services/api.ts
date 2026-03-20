import { SqlApi } from "@bibliothecadao/torii";
import { getActiveWorld } from "@/runtime/world";
import { env } from "../../env";

const ensureSqlSuffix = (baseUrl: string): string => (baseUrl.endsWith("/sql") ? baseUrl : `${baseUrl}/sql`);

let currentBaseUrl = (() => {
  const active = getActiveWorld();
  return ensureSqlSuffix(active?.toriiBaseUrl ?? env.VITE_PUBLIC_TORII);
})();

const cacheBaseUrl = env.VITE_PUBLIC_ENABLE_SQL_CACHE ? env.VITE_PUBLIC_REALTIME_URL : undefined;

export const createSqlApi = (baseUrl: string): SqlApi => new SqlApi(ensureSqlSuffix(baseUrl), cacheBaseUrl);

export let sqlApi = createSqlApi(currentBaseUrl);

export const setSqlApiBaseUrl = (baseUrl: string) => {
  currentBaseUrl = ensureSqlSuffix(baseUrl);
  sqlApi = createSqlApi(currentBaseUrl);
};

export const getSqlApiBaseUrl = () => currentBaseUrl;
