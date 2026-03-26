#!/usr/bin/env node

import { runAmmv2PackageTaskFromCli } from "../../support/command.js";

await runAmmv2PackageTaskFromCli({
  actionName: "deploy",
  args: process.argv,
  importMetaUrl: import.meta.url,
});
