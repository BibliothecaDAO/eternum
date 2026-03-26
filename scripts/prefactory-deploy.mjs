import { spawnSync } from "node:child_process";

const VALID_NETWORKS = ["local", "mainnet", "sepolia", "slot", "slottest"];
const SUPPORTED_FLAGS = new Set(["--skip-migrate"]);

function printUsage() {
  console.error("Usage: node scripts/prefactory-deploy.mjs <network> [--skip-migrate]");
  console.error(`  network must be one of: ${VALID_NETWORKS.join(", ")}`);
}

function resolvePnpmExecutable() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function resolvePrefactoryOptions(argv) {
  const network = argv[2];
  const rawFlags = argv.slice(3);

  if (!network || !VALID_NETWORKS.includes(network)) {
    printUsage();
    process.exit(1);
  }

  for (const flag of rawFlags) {
    if (!SUPPORTED_FLAGS.has(flag)) {
      printUsage();
      process.exit(1);
    }
  }

  return {
    network,
    skipMigrate: rawFlags.includes("--skip-migrate") || process.env.npm_config_skip_migrate === "true",
  };
}

function runPnpmCommand(args) {
  const result = spawnSync(resolvePnpmExecutable(), args, { stdio: "inherit" });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runMigration(network) {
  runPnpmCommand(["run", `game:migrate:${network}`]);
}

function copyManifestAbis(network) {
  runPnpmCommand(["run", "manifest:copy-abis", network]);
}

function syncConfig(network) {
  runPnpmCommand(["run", `config:sync:${network}`]);
}

function runPrefactoryDeploy(argv) {
  const options = resolvePrefactoryOptions(argv);

  if (!options.skipMigrate) {
    runMigration(options.network);
  }

  copyManifestAbis(options.network);
  syncConfig(options.network);
}

runPrefactoryDeploy(process.argv);
