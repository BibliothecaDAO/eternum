import { environmentL2, valuePlaneAddress, type ValueEnvironment } from "@realms-world/chain";

/** Relay and monitor use the same deployed address book as the client. */
export const ledgerAddress = (environment: ValueEnvironment) =>
  valuePlaneAddress("ledger", environmentL2(environment).network);
