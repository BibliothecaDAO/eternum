import { SqlApi } from "@bibliothecadao/torii";
import { getActiveWorld } from "@/runtime/world";
import { env } from "../../env";

let currentBaseUrl = (() => {
  const active = getActiveWorld();
  return (active?.toriiBaseUrl ?? env.VITE_PUBLIC_TORII) + "/sql";
})();

const cacheBaseUrl = env.VITE_PUBLIC_REALTIME_URL;

export let sqlApi = new SqlApi(currentBaseUrl, cacheBaseUrl);

export const setSqlApiBaseUrl = (baseUrl: string) => {
  currentBaseUrl = baseUrl.endsWith("/sql") ? baseUrl : `${baseUrl}/sql`;
  sqlApi = new SqlApi(currentBaseUrl, cacheBaseUrl);
};

export const getSqlApiBaseUrl = () => currentBaseUrl;
