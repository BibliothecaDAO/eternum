import { SqlApi } from "@bibliothecadao/torii";
import { env } from "../../env";

const API_BASE_URL = env.VITE_PUBLIC_TORII + "/sql";

export const sqlApi = new SqlApi(API_BASE_URL);
