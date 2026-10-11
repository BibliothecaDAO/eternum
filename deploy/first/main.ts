#!/usr/bin/env bun
import { join } from "node:path";
import { existsSync } from "node:fs";
import { Account, RpcProvider } from "starknet";
import { PrivateStore } from "./private-store";
import { environments, root, validateInputs, ACCOUNT_CLASS, type Environment, type Inputs } from "./settings";
import { accountIdentity, classAt, newKey, prepareAccounts, type Keys } from "./chain";
import {
  artifactsReady,
  boxRead,
  buildArtifacts,
  installedOperatorToken,
  operatorTokenPresent,
  installOperatorToken,
} from "./box";
import {
  assetPlans,
  configureLedger,
  deployAsset,
  existingAssets,
  loadArtifact,
  publishAssets,
  setupCalls,
  setupPresenceReader,
  verifyLedgerAccounts,
  type Assets,
} from "./ledger";
import { Platform, generateSecrets, workerSecrets, workers, type Secrets } from "./platform";
import { command } from "./process";
import { runSteps, type Step } from "./run";
import { deliverySteps } from "./delivery";
import { resolveBlitzSeason } from "./blitz-season";
import { seconds, PublicError } from "./dates";

export interface Deployment {
  environment: Environment;
  target: (typeof environments)[Environment];
  store: PrivateStore;
  apply: boolean;
  revision: string;
  inputs?: Inputs;
  keys?: Keys;
  secrets?: Secrets;
  provider?: RpcProvider;
  platform?: Platform;
  assets?: Assets;
  output: (line: string) => void;
}
export function signer(context: Deployment) {
  if (!context.provider || !context.keys) throw new Error("Account preparation has not completed");
  return new Account({
    provider: context.provider,
    address: accountIdentity(context.keys.deployer).address,
    signer: context.keys.deployer,
  });
}
function reload(context: Deployment) {
  context.inputs = context.store.read<Inputs>("inputs.json");
  context.keys = context.store.read<Keys>("keys.json");
  context.secrets = context.store.read<Secrets>("secrets.json");
  if (context.inputs) {
    validateInputs(context.inputs, context.target);
    context.provider = new RpcProvider({ nodeUrl: context.inputs.rpc, blockIdentifier: "latest" });
    context.platform = new Platform(context.target, context.inputs, context.store, context.apply);
  }
}
async function prompt(label: string) {
  if (!process.stdin.isTTY) throw new Error("Enter initial settings in the owner's interactive terminal");
  process.stdout.write(`${label}: `);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise<string>((resolve, reject) => {
    let value = "";
    const finish = () => {
      process.stdin.off("data", read);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    };
    const read = (bytes: Buffer) => {
      for (const char of bytes.toString()) {
        if (char === "\u0003") {
          finish();
          reject(new Error("Input cancelled"));
          return;
        }
        if (char === "\r" || char === "\n") {
          finish();
          resolve(value.trim());
          return;
        }
        if (char === "\u007f") value = value.slice(0, -1);
        else if (char >= " ") value += char;
      }
    };
    process.stdin.on("data", read);
  });
}
async function collectInputs(context: Deployment) {
  const inputs: Inputs = {
    cloudflareToken: await prompt("Cloudflare token"),
    rpc: await prompt("Alchemy mainnet URL"),
    resend: await prompt("Resend key"),
    amount: await prompt("Frontier deposit in whole tokens"),
    frontierStart: await prompt("Frontier start, YYYY-MM-DDTHH:MM:SSZ"),
    frontierEnd: await prompt("Frontier end, YYYY-MM-DDTHH:MM:SSZ"),
    blitzStart: await prompt("Blitz start, YYYY-MM-DDTHH:MM:SSZ"),
    blitzEnd: await prompt("Blitz end, YYYY-MM-DDTHH:MM:SSZ"),
  };
  if (context.target.coldAdmin) {
    inputs.admin = await prompt("Public cold admin account address (never its key)");
    inputs.treasury = await prompt("Public treasury address");
  }
  validateInputs(inputs, context.target);
  context.store.write("inputs.json", inputs);
  reload(context);
  context.output(
    `Frontier ${inputs.frontierStart} to ${inputs.frontierEnd}, pool ${inputs.amount}; Blitz ${inputs.blitzStart} to ${inputs.blitzEnd}.`,
  );
}
const waiting = (detail: string) => ({ done: false, waiting: detail, detail });
export function preparationSteps(context: Deployment): Step[] {
  let readSetup: ReturnType<typeof setupPresenceReader> | undefined;
  return [
    {
      name: "Owner settings",
      payer: "none",
      cost: "0 STRK",
      inspect: async () => ({
        done: !!context.inputs,
        detail:
          "three credentials, deposit and four explicit season dates saved privately; production also needs two public account addresses",
      }),
      apply: () => collectInputs(context),
    },
    {
      name: "Deployment prerequisites",
      payer: "none",
      cost: "0 STRK",
      inspect: async () => {
        if (!context.platform) return waiting("Settings are not available yet");
        if (!existsSync(join(root, "deploy/release", `${context.target.release}.json`)))
          return waiting(
            `Review and commit deploy/release/${context.target.release}.json and provision ${context.target.box} before funding an account`,
          );
        await context.platform.accountId();
        await command({ argv: ["gh", "api", "repos/{owner}/{repo}"] });
        await boxRead(
          context.target,
          'test -d /opt/athanor; test -x "$HOME/cairo-suite/tool-data/scarb-install/2.13.1/bin/scarb"; docker compose version >/dev/null',
        );
        return {
          done: true,
          detail: "Cloudflare account, GitHub access, reviewed release and provisioned box checked",
        };
      },
      apply: async () => {},
    },
    {
      name: "Account identities",
      payer: "none",
      cost: "0 STRK",
      inspect: async () => {
        if (!context.provider) return waiting("Settings are not available; account class cannot be checked yet");
        if (BigInt(await context.provider.getChainId()) !== 0x534e5f4d41494en)
          throw new Error("Starknet mainnet required");
        await context.provider.getClassByHash(ACCOUNT_CLASS);
        return {
          done: !!context.keys,
          detail: "three separate mainnet keys and two shard keys; one deployer address to fund",
        };
      },
      apply: async () => {
        context.store.write(
          "keys.json",
          Object.fromEntries(
            ["deployer", "relay", "monitor", "launcher", "shardRelay"].map((role) => [role, newKey()]),
          ),
        );
        reload(context);
      },
    },
    {
      name: "Fund and deploy accounts",
      payer: "deployer",
      cost: "250 STRK starting reserve includes 30 for relay and 1 for monitor; account fees not measured",
      inspect: async () => {
        if (!context.keys || !context.provider) return waiting("Account identities are not available yet");
        const states = await Promise.all(
          (["deployer", "relay", "monitor"] as const).map((role) =>
            classAt(context.provider!, accountIdentity(context.keys![role]).address),
          ),
        );
        return {
          done: states.every(Boolean),
          detail: states.every(Boolean)
            ? "all three accounts exist"
            : `deploy missing accounts and transfer only missing initial STRK; fund only ${accountIdentity(context.keys.deployer).address}`,
        };
      },
      apply: async () => {
        await prepareAccounts(context.provider!, context.keys!, context.store, context.output);
      },
    },
    {
      name: "Release artifacts",
      payer: "none",
      cost: "0 STRK; remote build time",
      inspect: async () => ({
        done: artifactsReady(context.store, context.revision),
        detail: "ledger, rating token and collectibles; Scarb 2.13.1 on the box under flock, cores 8-11",
      }),
      apply: () => buildArtifacts(context.target, context.store, context.revision),
    },
    {
      name: "Ledger and assets",
      payer: "deployer",
      cost: "measured first dev declaration/deployment/setup/funding total about 84 STRK; budget 200",
      inspect: async () => {
        const assets = existingAssets(context.target);
        if (Object.keys(assets).length !== 5 || !context.provider)
          return {
            done: false,
            detail: "declare absent classes; deploy missing contracts at fixed salts; publish public addresses",
          };
        for (const address of Object.values(assets))
          if (!(await classAt(context.provider, address))) throw new Error("Address book names an absent contract");
        if (!context.keys || !context.inputs) return waiting("Saved account identities unavailable");
        await verifyLedgerAccounts(
          context.provider,
          assets.ledger!,
          context.inputs.admin ?? accountIdentity(context.keys.deployer).address,
          accountIdentity(context.keys.relay).address,
        );
        context.assets = assets as Assets;
        return { done: true, detail: "all public addresses resolve to deployed contracts" };
      },
      apply: async () => {
        const account = signer(context);
        const admin = context.inputs!.admin ?? account.address;
        const treasury = context.inputs!.treasury ?? account.address;
        const assets = existingAssets(context.target);
        if (
          !context.target.freshAssets &&
          ["lords", "mmr", "chests", "cosmetics"].some((name) => !assets[name as keyof Assets])
        )
          throw new Error("Production asset addresses must already exist in the public address book");
        for (const plan of assetPlans(
          context.target,
          admin,
          accountIdentity(context.keys!.relay).address,
          treasury,
          assets,
        ).filter((plan) => plan.name !== "ledger")) {
          assets[plan.name] = await deployAsset(
            account,
            context.environment,
            plan,
            loadArtifact(join(context.store.directory, "artifacts"), plan),
            context.store,
          );
        }
        const plan = assetPlans(
          context.target,
          admin,
          accountIdentity(context.keys!.relay).address,
          treasury,
          assets,
        ).find((plan) => plan.name === "ledger")!;
        assets.ledger = await deployAsset(
          account,
          context.environment,
          plan,
          loadArtifact(join(context.store.directory, "artifacts"), plan),
          context.store,
        );
        publishAssets(context.target, assets as Assets);
        context.assets = assets as Assets;
      },
    },
    {
      name: "Ledger setup",
      payer: context.target.coldAdmin ? "cold admin" : "deployer",
      cost: "included in the 200 STRK deployment reserve",
      inspect: async () => {
        if (!context.assets || !context.provider || !context.keys || !context.inputs)
          return waiting("Contracts have not been deployed yet");
        const season = await resolveBlitzSeason(
          context.provider,
          context.assets.ledger,
          seconds(context.inputs.blitzStart),
          seconds(context.inputs.blitzEnd),
        );
        const calls = setupCalls(
          context.target,
          context.assets,
          accountIdentity(context.keys.monitor).address,
          seconds(context.inputs.blitzStart),
          seconds(context.inputs.blitzEnd),
          season.id,
        );
        readSetup ??= setupPresenceReader(context.provider);
        const present = await Promise.all(calls.map((call) => readSetup!(call, season.head)));
        return {
          done: present.every(Boolean),
          detail: `${present.filter(Boolean).length}/${calls.length} setup results present; only missing calls will be prepared; Blitz dates exactly as entered, with its start still in the future`,
        };
      },
      apply: async () => {
        const ready = await configureLedger(
          signer(context),
          context.target,
          context.assets!,
          accountIdentity(context.keys!.monitor).address,
          context.inputs!,
          context.store,
          readSetup,
        );
        if (!ready)
          context.output(
            "Cold admin: review and execute the public calls in cold-setup.json with your wallet, then rerun. The script never holds your cold key.",
          );
      },
    },
    {
      name: "Service credentials",
      payer: "none",
      cost: "0 STRK",
      inspect: async () => ({
        done: !!context.secrets,
        detail: "reuse the box operator token and the existing guardian; generate only absent credentials",
      }),
      apply: async () => {
        const guardian = workers.find((worker) => worker.id === "guardian")!;
        const guardianExists = (await context.platform!.secretNames(guardian)).includes("GUARDIAN_PRIVATE_KEY");
        const operator = (await installedOperatorToken(context.target)).trim();
        context.store.write("secrets.json", generateSecrets(operator, guardianExists));
        reload(context);
      },
    },
    {
      name: "Cloudflare resources",
      payer: "none",
      cost: "Cloudflare plan charges; 0 STRK",
      inspect: async () =>
        context.platform
          ? {
              done: await context.platform.resourcesPresent(),
              detail: "identity/launch D1, status R2, Pages project and client domain",
            }
          : waiting("Cloudflare token unavailable"),
      apply: async () => context.platform!.prepareResources(),
    },
    {
      name: "Worker secrets",
      payer: "none",
      cost: "0 STRK",
      inspect: async () => {
        if (!context.platform || !context.secrets || !context.keys || !context.inputs)
          return waiting("Private credentials unavailable");
        let complete = true;
        for (const worker of workers) {
          complete &&= await context.platform.secretsPresent(
            worker,
            workerSecrets(worker, context.inputs, context.secrets, context.keys),
          );
          if (worker.id === "guardian")
            complete &&= (await context.platform.secretNames(worker)).includes("GUARDIAN_PRIVATE_KEY");
        }
        return {
          done: complete,
          detail:
            "unchanged saved credentials skipped after checking remote names; uploads on standard input; deployer key stays on owner machine",
        };
      },
      apply: async () => {
        await context.platform!.bootstrapWorkers();
        for (const worker of workers)
          await context.platform!.installSecrets(
            worker,
            workerSecrets(worker, context.inputs!, context.secrets!, context.keys!),
          );
      },
    },
    {
      name: "Box operator credential",
      payer: "none",
      cost: "0 STRK",
      inspect: async () => {
        if (!context.apply)
          return {
            done: await operatorTokenPresent(context.target),
            detail: "protected box credential presence and mode checked without reading its contents",
          };
        const existing = (await installedOperatorToken(context.target)).trim();
        if (existing && context.secrets && existing !== context.secrets.operator)
          throw new Error("Box operator token differs; restore the original private directory");
        return { done: !!existing, detail: "protected operator file on box; no mainnet key copied to it" };
      },
      apply: async () => installOperatorToken(context.target, context.secrets!.operator),
    },
  ];
}
export async function main(args = process.argv.slice(2)) {
  const [environment, directory, flag] = args;
  if (
    (environment !== "dev" && environment !== "production") ||
    !directory ||
    args.length > 3 ||
    (flag && flag !== "--apply")
  )
    throw new Error("Usage: pnpm deploy:first <dev|production> /absolute/private-directory [--apply]");
  process.umask(0o077);
  const apply = flag === "--apply";
  const store = new PrivateStore(directory, root, apply);
  const saved = store.read<{ environment: Environment; revision: string }>("deployment.json");
  if (saved && saved.environment !== environment) throw new Error("Private directory belongs to another environment");
  const revision = saved?.revision ?? (await command({ argv: ["git", "rev-parse", "HEAD"] })).trim();
  const context: Deployment = {
    environment,
    target: environments[environment],
    store,
    apply,
    revision,
    output: console.log,
  };
  reload(context);
  const unlock = apply ? store.lock() : () => {};
  try {
    if (apply && !saved) store.write("deployment.json", { environment, revision });
    if (context.inputs)
      context.output(
        `Frontier ${context.inputs.frontierStart} to ${context.inputs.frontierEnd}, pool ${context.inputs.amount}; Blitz ${context.inputs.blitzStart} to ${context.inputs.blitzEnd}.`,
      );
    context.output(
      apply
        ? "Applying missing first-deployment steps."
        : "DRY RUN: no keys generated, no writes or transactions. Use --apply to act.",
    );
    await runSteps([...preparationSteps(context), ...deliverySteps(context)], apply, context.output);
  } finally {
    unlock();
  }
}
if (import.meta.main)
  main().catch((error) => {
    if (error instanceof PublicError) console.error(error.message);
    else
      console.error(
        "Deployment stopped. No SDK, subprocess or secret-bearing error was printed. Inspect the last named step; rerun after its prerequisite is ready.",
      );
    process.exitCode = 1;
  });
