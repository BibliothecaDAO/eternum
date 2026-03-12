/**
 * CLI entry point — invokes {@link main} and exits with a non-zero code on
 * unhandled fatal errors.
 */

import { main } from "./main.js";

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
