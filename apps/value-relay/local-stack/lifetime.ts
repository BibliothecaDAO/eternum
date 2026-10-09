import { execFileSync } from "node:child_process";
import { readFile, readdir, rm, rmdir, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readPrivate } from "./config";
interface State {
  directory: string;
  pid: string;
}
interface Record {
  pid: number;
  configPath: string;
  runDirectory: string;
}

export const processAlive = (pid: number) => {
  if (!Number.isSafeInteger(pid) || pid <= 1) throw new Error("invalid_stack_pid");
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
};
export const readRecord = async (state: State): Promise<Record | null> => {
  try {
    return await readPrivate<Record>(state.pid);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};
export const recoverStaleState = async (state: State) => {
  const record = await readRecord(state);
  if (!record) return;
  if (processAlive(record.pid)) throw new Error("stack_already_running");
  await removeStackState(state);
  await mkdir(state.directory, { recursive: true, mode: 0o700 });
};

/** The directory label owns containers; process names and recycled PIDs do not. */
export const removeStackState = async (state: State) => {
  const ids = execFileSync(
    "docker",
    ["ps", "-aq", "--filter", `label=eternum.value-state=${resolve(state.directory)}`],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  )
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (ids.some((id) => !/^[0-9a-f]{12,64}$/.test(id))) throw new Error("invalid_owned_container_id");
  if (ids.length) execFileSync("docker", ["rm", "-f", ...ids], { stdio: "ignore" });
  for (const entry of await readdir(state.directory, { withFileTypes: true }))
    if (/^run-\d+$/.test(entry.name) && entry.isDirectory())
      await rm(join(state.directory, entry.name), { recursive: true, force: true });
  await rm(state.pid, { force: true });
  try {
    await rmdir(state.directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOTEMPTY") throw error;
  }
};

export const stopStack = async (state: State, configPath: string) => {
  const record = await readRecord(state);
  if (record && processAlive(record.pid)) {
    const command = await readFile(`/proc/${record.pid}/cmdline`, "utf8");
    if (
      record.configPath !== resolve(configPath) ||
      !command.includes("local-stack/up.ts") ||
      !command.includes(configPath)
    )
      throw new Error("stack_process_identity_differs");
    process.kill(record.pid, "SIGTERM");
    for (let attempt = 0; processAlive(record.pid); attempt++) {
      if (attempt >= 120) throw new Error("stack_shutdown_timeout");
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  await removeStackState(state);
};
