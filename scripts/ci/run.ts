import { readFileSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  interpolate,
  root,
  selectedStep,
  runtimePin,
  runtimeMatches,
  stepEnvironment,
  validationJobs,
  type Environment,
  type Step,
  type ValidationJob,
} from "./jobs";

const inherited = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);
const setupActions = new Set([
  "actions/checkout@v4",
  "pnpm/action-setup@v4",
  "software-mansion/setup-universal-sierra-compiler@v1",
]);

function command(argv: string[], env: Environment, cwd = root, capture = false): string {
  const result = Bun.spawnSync(argv, { cwd, env, stdout: capture ? "pipe" : "inherit", stderr: "inherit" });
  if (result.exitCode !== 0) throw new Error(`Command failed (${result.exitCode}): ${argv.join(" ")}`);
  return capture ? result.stdout.toString().trim() : "";
}

function installRuntime(pin: NonNullable<ReturnType<typeof runtimePin>>, env: Environment) {
  const executable = command(
    ["npm", "exec", "--yes", `--package=${pin.name}@${pin.version}`, "--", pin.name, "-p", "process.execPath"],
    env,
    root,
    true,
  );
  const bin = mkdtempSync(join(env.RUNNER_TEMP!, "runtime-"));
  symlinkSync(executable, join(bin, pin.name));
  env.PATH = [bin, env.PATH].join(delimiter);
  const actual = command([pin.name, "--version"], env, root, true);
  if (!runtimeMatches(pin.version, actual)) throw new Error(`${pin.name}: wanted ${pin.version}, got ${actual}`);
  console.log(JSON.stringify({ runtime: pin.name, requested: pin.version, actual }));
}

function removeBuiltPackagesAFreshCheckoutLacks(env: Environment) {
  const ignored = command(
    ["git", "ls-files", "--others", "--ignored", "--exclude-standard", "--directory", "--", "packages"],
    env,
    root,
    true,
  );
  for (const path of ignored.split("\n").filter((entry) => entry.endsWith("/dist/"))) {
    rmSync(resolve(root, path), { recursive: true, force: true });
  }
}

function hideToolchainsUntilSetUp(env: Environment) {
  const bin = mkdtempSync(join(env.RUNNER_TEMP!, "unset-toolchains-"));
  for (const tool of ["scarb", "snforge"]) {
    const refusal = `echo "${tool} is not set up in this job: add its setup action before the step" >&2; exit 127`;
    writeFileSync(join(bin, tool), `#!/bin/sh\n${refusal}\n`, { mode: 0o755 });
  }
  env.PATH = [bin, env.PATH].join(delimiter);
}

function installToolchain(step: Step, context: Record<string, Environment>, env: Environment) {
  const file = interpolate(step.with?.["tool-versions"] ?? ".tool-versions", context);
  const tool = step.uses === "software-mansion/setup-scarb@v1" ? "scarb" : "starknet-foundry";
  const version = readFileSync(resolve(root, file), "utf8")
    .split(/\r?\n/)
    .map((line) => line.split(/\s+/))
    .find(([name]) => name === tool)?.[1];
  if (!version) throw new Error(`Missing ${tool} pin in ${file}`);
  const directory = command(["asdf", "where", tool, version], env, root, true);
  env.PATH = [join(directory, "bin"), env.PATH].join(delimiter);
  env[tool === "scarb" ? "ASDF_SCARB_VERSION" : "ASDF_STARKNET_FOUNDRY_VERSION"] = version;
}

async function startPostgres(job: ValidationJob, env: Environment): Promise<() => void> {
  const services = Object.entries(job.job.services ?? {});
  if (services.length === 0) return () => {};
  if (services.length !== 1 || services[0]![0] !== "postgres") throw new Error(`Unsupported services: ${job.id}`);
  const service = services[0]![1];
  const id = command(
    [
      "docker",
      "run",
      "--rm",
      "--detach",
      "--publish",
      "127.0.0.1::5432",
      ...Object.entries(service.env).flatMap(([key, value]) => ["--env", `${key}=${value}`]),
      service.image,
    ],
    env,
    root,
    true,
  );
  const stop = () => command(["docker", "rm", "--force", id], env);
  try {
    const port = command(["docker", "port", id, "5432/tcp"], env, root, true).split(":").at(-1)!;
    for (const key of Object.keys(job.job.env ?? {})) {
      if (env[key]?.startsWith("postgres://")) {
        const url = new URL(env[key]!);
        url.port = port;
        env[key] = url.toString();
      }
    }
    for (let attempt = 0; attempt < 60; attempt++) {
      const ready = Bun.spawnSync(
        ["docker", "exec", id, "pg_isready", "-U", service.env.POSTGRES_USER!, "-d", service.env.POSTGRES_DB!],
        { stdout: "ignore", stderr: "ignore" },
      );
      if (ready.exitCode === 0) return stop;
      await Bun.sleep(1000);
    }
    throw new Error(`Postgres did not become ready: ${id}`);
  } catch (error) {
    stop();
    throw error;
  }
}

function runStep(step: Step, job: ValidationJob, env: Environment) {
  const context = { matrix: job.matrix };
  if (!selectedStep(step, job.matrix)) return;
  console.log(JSON.stringify({ job: job.id, step: step.name ?? step.run ?? step.uses }));
  const runtime = runtimePin(step);
  if (runtime) {
    installRuntime(runtime, env);
  } else if (step.run) {
    if (step.shell && step.shell !== "bash") throw new Error(`Unsupported shell: ${step.shell}`);
    const cwd = resolve(
      root,
      interpolate(step["working-directory"] ?? job.job.defaults?.run?.["working-directory"] ?? ".", context),
    );
    command(
      ["bash", "--noprofile", "--norc", "-eo", "pipefail", "-c", interpolate(step.run, context)],
      { ...env, ...stepEnvironment(step.env, context) },
      cwd,
    );
  } else if (step.uses === "software-mansion/setup-scarb@v1" || step.uses === "foundry-rs/setup-snfoundry@v3") {
    installToolchain(step, context, env);
  } else if (step.uses === "./.github/actions/checkout-without-media") {
    command(["bash", ".github/actions/checkout-without-media/set-sparse-checkout.sh"], {
      ...env,
      KEEP: step.with?.keep ?? "",
    });
  } else if (step.uses === "./.github/actions/fetch-cairo-dependencies") {
    const action = Bun.YAML.parse(
      readFileSync(resolve(root, ".github/actions/fetch-cairo-dependencies/action.yml"), "utf8"),
    ) as { runs: { steps: Step[] } };
    for (const child of action.runs.steps) {
      const inputs = { inputs: step.with ?? {} };
      runStep(
        {
          ...child,
          run: interpolate(child.run!, inputs),
          "working-directory": interpolate(child["working-directory"]!, inputs),
        },
        job,
        env,
      );
    }
  } else if (!step.uses || !setupActions.has(step.uses)) {
    throw new Error(`Unsupported validation action: ${step.uses}`);
  }
}

async function runJob(id: string) {
  const job = validationJobs().find((candidate) => candidate.id === id);
  if (!job) throw new Error(`Unknown validation job: ${id}`);
  if (job.job["runs-on"] !== "ubuntu-latest") throw new Error(`Unsupported validation platform: ${job.job["runs-on"]}`);
  const env: Environment = { ...inherited, ...stepEnvironment(job.job.env, { matrix: job.matrix }), CI: "true" };
  env.RUNNER_TEMP ??= mkdtempSync(join(env.FLOW_TMP ?? tmpdir(), "ci-"));
  removeBuiltPackagesAFreshCheckoutLacks(env);
  hideToolchainsUntilSetUp(env);
  const stop = await startPostgres(job, env);
  const interrupted = () => {
    stop();
    process.exit(130);
  };
  process.once("SIGINT", interrupted);
  process.once("SIGTERM", interrupted);
  try {
    for (const step of job.job.steps) runStep(step, job, env);
  } finally {
    process.removeListener("SIGINT", interrupted);
    process.removeListener("SIGTERM", interrupted);
    stop();
    command(["git", "sparse-checkout", "disable"], env);
  }
}

await runJob(process.argv[2] ?? "");
