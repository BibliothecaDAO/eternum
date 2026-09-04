#!/usr/bin/env node

import { runAmmv2PackageTaskFromCli } from "../../support/command.js";

await runAmmv2PackageTaskFromCli({
  actionName: "grant-roles",
  args: process.argv,
  importMetaUrl: import.meta.url,
});
