import constants from "./contract-constants.json";

/**
 * Rules the contracts hold as literals the client schema does not export, each copied once beside its Cairo line
 * (contract-constants.json); scripts/contract-constants.test.mjs fails when a line changes.
 */
export const CONTRACT = Object.fromEntries(constants.map(({ key, value }) => [key, value])) as Record<
  (typeof constants)[number]["key"],
  number
>;
