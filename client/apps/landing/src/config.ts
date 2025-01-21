import { getLordsAddress, getRealmsAddress, getSeasonPassAddress } from "./components/ui/utils/addresses";

export const lordsAddress = await getLordsAddress();
export const seasonPassAddress = await getSeasonPassAddress();
export const realmsAddress = await getRealmsAddress();
