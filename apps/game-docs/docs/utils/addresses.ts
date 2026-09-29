import { DOCS_CHAIN } from "@/../env";
import { getSeasonAddresses } from "../../../../contracts/utils/utils";

export const getResourceAddresses = () => getSeasonAddresses(DOCS_CHAIN).resources;
