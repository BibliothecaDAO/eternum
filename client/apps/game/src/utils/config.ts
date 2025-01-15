import { getConfigFromNetwork, type NetworkType } from "../../../../config/utils/environment";
import { env } from "./../../env";


export const ETERNUM_CONFIG = async () => {
    const config = await getConfigFromNetwork(env.VITE_PUBLIC_CHAIN! as NetworkType);
    return config;
};
      