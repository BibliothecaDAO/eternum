import { SqlApi } from "@bibliothecadao/torii";
import { env } from "../../../env";

let currentBaseUrl = `${env.VITE_PUBLIC_TORII}/sql`;

export let sqlApi = new SqlApi(currentBaseUrl);

export const setSqlApiBaseUrl = (baseUrl: string) => {
  currentBaseUrl = baseUrl.endsWith("/sql") ? baseUrl : `${baseUrl}/sql`;
  sqlApi = new SqlApi(currentBaseUrl);
};

export const getSqlApiBaseUrl = () => currentBaseUrl;
