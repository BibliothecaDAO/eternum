#!/usr/bin/env bun
import { setupQuestions, validateInputs } from "./dates";
import { deploymentRevision } from "./revision";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { Account, RpcProvider, logger } from "starknet";
import { PrivateStore } from "./private-store";
import { environments, root, ACCOUNT_CLASS, type Environment, type Inputs } from "./settings";
import { accountIdentity, classAt, isDeploymentBlock, newKey, prepareAccounts, type Keys } from "./chain";
import {
  artifactsReady,
  boxRead,
  buildArtifacts,
  operatorTokenMatches,
  operatorTokenPresent,
  installOperatorToken,
} from "./box";
import {
  assetPlans,
  configureLedger,
  deployAsset,
  existingAssets,
  deploymentBlock,
  recordedLedgerBlock,
  loadArtifact,
  publishAssets,
  setupCalls,
  setupPresenceReader,
  verifyLedgerAccounts,
  type Assets,
} from "./ledger";
import { Platform, generateSecrets, workerSecrets, workers, type Secrets } from "./platform";
import {
  ADMIN_ACCESS,
  ADMIN_ACCESS_LIST,
  adminAccessListExample,
  readAdminAccessList,
  syncAdminAccess,
  type AdminAccess,
} from "./admin-access";
import { command } from "./process";
import { runSteps, type Step } from "./run";
import { addressBookStep } from "./address-book";
import { resolveBlitzSeason } from "./blitz-season";
import { seconds } from "./dates";
import { PublicError, reportFailure } from "./errors";

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
export function signer(context: Pick<Deployment, "provider" | "keys">) {
  if (!context.provider || !context.keys) throw new PublicError("Account preparation has not completed");
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
  if (!process.stdin.isTTY) throw new PublicError("Enter initial settings in the owner's interactive terminal");
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
          reject(new PublicError("Input cancelled"));
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
  const answers: Partial<Record<keyof Inputs, string>> = {};
  for (const [name, question] of setupQuestions(context.target)) answers[name] = await prompt(question);
  const inputs = answers as Inputs;
  validateInputs(inputs, context.target);
  context.store.write("inputs.json", inputs);
  reload(context);
  context.output(
    `Frontier preset ${inputs.frontierPresetId} ${inputs.frontierStart} to ${inputs.frontierEnd}, pool ${inputs.amount}; Blitz ${inputs.blitzStart} to ${inputs.blitzEnd}.`,
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
          "three credentials, the Discord application, deposit and four explicit season dates saved privately; production also needs two public account addresses",
      }),
      apply: () => collectInputs(context),
    },
    {
      name: "Deployment prerequisites",
      payer: "none",
      cost: "0 STRK",
      inspect: async () => {
        if (!context.platform) return waiting("Settings are not available yet");
        if (!existsSync(join(root, "deploy/release", `${context.target.environment}.json`)))
          return waiting(
            `Review and commit deploy/release/${context.target.environment}.json and provision ${context.target.box} before funding an account`,
          );
        await context.platform.checkAccess();
        await command({ argv: ["gh", "api", "repos/{owner}/{repo}"] });
        await boxRead(context.target, "test -d /opt/athanor; docker compose version");
        return {
          done: true,
          detail: "Cloudflare resource reads, GitHub access, reviewed release and provisioned box checked",
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
          throw new PublicError("Starknet mainnet required");
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
        done: await artifactsReady(context.store, context.revision),
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
          if (!(await classAt(context.provider, address)))
            throw new PublicError("Address book names an absent contract");
        if (!context.keys || !context.inputs) return waiting("Saved account identities unavailable");
        await verifyLedgerAccounts(
          context.provider,
          assets.ledger!,
          context.inputs.admin ?? accountIdentity(context.keys.deployer).address,
          accountIdentity(context.keys.relay).address,
        );
        const block = recordedLedgerBlock(context.target);
        if (block === undefined || !(await isDeploymentBlock(context.provider, assets.ledger!, block)))
          return { done: false, detail: "record the ledger's deployment block beside its address" };
        context.assets = assets as Assets;
        return { done: true, detail: "all public addresses resolve to deployed contracts" };
      },
      apply: async () => {
        const account = signer(context);
        const admin = context.inputs!.admin ?? account.address;
        const treasury = context.inputs!.treasury ?? account.address;
        const assets = existingAssets(context.target);
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
            context.output,
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
          context.output,
        );
        const head = await context.provider!.getBlockNumber();
        publishAssets(context.target, assets as Assets, await deploymentBlock(context.provider!, assets.ledger, head));
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
          Number(context.inputs.frontierPresetId),
        );
        context.output("Reading collectible metadata on mainnet.");
        readSetup ??= setupPresenceReader(context.provider);
        const present = await Promise.all(calls.map((call) => readSetup!(call, season.head)));
        return {
          done: present.every(Boolean),
          detail: `${present.filter(Boolean).length}/${calls.length} setup results present; only missing calls will be prepared; Blitz dates exactly as entered`,
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
          context.output,
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
        detail: "reuse saved credentials and the existing guardian; generate only absent credentials",
      }),
      apply: async () => {
        const guardian = workers.find((worker) => worker.id === "guardian")!;
        const guardianExists = (await context.platform!.secretNames(guardian)).includes("GUARDIAN_PRIVATE_KEY");
        if (await operatorTokenPresent(context.target))
          throw new PublicError("Box already has an operator credential; use the original private directory");
        context.store.write("secrets.json", generateSecrets(guardianExists));
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
              detail: "identity/launch D1, status R2, and the client's and docs' Pages sites with their hostnames",
            }
          : waiting("Cloudflare token unavailable"),
      apply: async () => context.platform!.prepareResources(),
    },
    {
      name: "Admin access",
      payer: "none",
      cost: "0 STRK; Cloudflare Access is free for up to 50 users",
      inspect: async () => {
        if (!context.platform) return waiting("Cloudflare token unavailable");
        const list = readAdminAccessList(context.store, context.environment);
        if (!list)
          return waiting(
            `Write ${ADMIN_ACCESS_LIST} (mode 0600) in the private directory, for example ${adminAccessListExample(context.environment)}`,
          );
        const { changed } = await syncAdminAccess(context.platform, context.store, context.environment, list, false);
        return {
          done: !changed,
          detail: `one-time PIN login and the admin page's Access application with the private directory's operators${list.writers ? "; its writers go to the admin Worker" : ""}`,
        };
      },
      apply: async () => {
        const list = readAdminAccessList(context.store, context.environment);
        if (!list) throw new PublicError(`Write ${ADMIN_ACCESS_LIST} in the private directory first`);
        await syncAdminAccess(context.platform!, context.store, context.environment, list, true);
      },
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
          if (worker.id === "admin" && !context.store.read<AdminAccess>(ADMIN_ACCESS)) {
            complete = false;
            continue;
          }
          complete &&= await context.platform.secretsPresent(
            worker,
            workerSecrets(worker, context.inputs, context.secrets, context.keys, context.store.read(ADMIN_ACCESS)),
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
            workerSecrets(worker, context.inputs!, context.secrets!, context.keys!, context.store.read(ADMIN_ACCESS)),
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
        const existing = await operatorTokenPresent(context.target);
        if (existing && context.secrets && !(await operatorTokenMatches(context.target, context.secrets.operator)))
          throw new PublicError("Box operator token differs; restore the original private directory");
        return { done: !!existing, detail: "protected operator file on box; no mainnet key copied to it" };
      },
      apply: async () => installOperatorToken(context.target, context.secrets!.operator),
    },
  ];
}
export async function main(args = process.argv.slice(2)) {
  logger.setLogLevel("OFF");
  const [environment, directory, flag] = args;
  if (
    (environment !== "dev" && environment !== "production") ||
    !directory ||
    args.length > 3 ||
    (flag && flag !== "--apply")
  )
    throw new PublicError("Usage: pnpm run setup <dev|production> /absolute/private-directory [--apply]");
  process.umask(0o077);
  const apply = flag === "--apply";
  const store = new PrivateStore(directory, root, apply);
  const saved = store.read<{ environment: Environment }>("deployment.json");
  if (saved && saved.environment !== environment)
    throw new PublicError("Private directory belongs to another environment");
  const revision = await deploymentRevision(environment);
  const context: Deployment = {
    environment,
    target: environments[environment],
    store,
    apply,
    revision,
    output: console.log,
  };
  reload(context);
  context.output(`Deployment commit ${revision}.`);
  const unlock = apply ? store.lock() : () => {};
  try {
    if (apply && !saved) store.write("deployment.json", { environment });
    if (context.inputs)
      context.output(
        `Frontier preset ${context.inputs.frontierPresetId} ${context.inputs.frontierStart} to ${context.inputs.frontierEnd}, pool ${context.inputs.amount}; Blitz ${context.inputs.blitzStart} to ${context.inputs.blitzEnd}.`,
      );
    context.output(
      apply
        ? "Applying missing first-deployment steps."
        : "DRY RUN: no keys generated, no writes or transactions. Use --apply to act.",
    );
    await runSteps([...preparationSteps(context), addressBookStep(context)], apply, context.output);
  } finally {
    unlock();
  }
}
if (import.meta.main) main().catch(reportFailure);
