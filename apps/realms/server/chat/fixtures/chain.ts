/** The chat integration test supplies a deployed ledger without changing the real address book. */
export * from "../../../../../packages/chain/dist/index.js";
import { environmentL2 as deployedL2, type ValueEnvironment } from "../../../../../packages/chain/dist/index.js";
export const environmentL2 = (environment: ValueEnvironment) => ({ ...deployedL2(environment), ledger: "0x123" });
