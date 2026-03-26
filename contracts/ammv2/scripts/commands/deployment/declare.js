#!/usr/bin/env node

import { runAmmv2PackageTaskFromCli } from "../../support/command.js";

await runAmmv2PackageTaskFromCli({
  actionName: "declare",
  args: process.argv,
  importMetaUrl: import.meta.url,
});
