import { createContext } from "react";

/**
 * True inside a panel a sheet can open from (a nav page): on a desktop the sheet then takes that panel's place, and its
 * mark steps back to it instead of closing.
 */
export const OpenedFromPanel = createContext(false);
