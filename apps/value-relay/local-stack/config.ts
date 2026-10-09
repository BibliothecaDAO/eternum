import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve, join, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";

export interface StackConfig {
  stateDirectory: string;
  frontendDirectory: string;
  port: number;
  devnetPort: number;
  shardRpcUrl: string;
  shardHeraldUrl: string;
  guardianKeyFile: string;
  launcherKeyFile: string;
  ledgerOperatorKeyFile: string;
  frontierGameId: number;
}

export const loopbackUrl = (value: string): URL => {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error("loopback_url_required");
  return url;
};

export const readConfig = async (path: string): Promise<StackConfig> => {
  const config = JSON.parse(await readFile(path, "utf8")) as StackConfig;
  loopbackUrl(config.shardRpcUrl);
  loopbackUrl(config.shardHeraldUrl);
  if (
    ![config.port, config.devnetPort].every((port) => Number.isInteger(port) && port > 1024 && port < 65536) ||
    config.port === config.devnetPort ||
    !Number.isSafeInteger(config.frontierGameId) ||
    config.frontierGameId < 1
  )
    throw new Error("invalid_stack_ports_or_game");
  for (const key of [
    "stateDirectory",
    "frontendDirectory",
    "guardianKeyFile",
    "launcherKeyFile",
    "ledgerOperatorKeyFile",
  ] as const)
    if (!config[key] || !config[key].startsWith("/")) throw new Error("absolute_private_paths_required");
  const privatePaths = [
    config.stateDirectory,
    config.guardianKeyFile,
    config.launcherKeyFile,
    config.ledgerOperatorKeyFile,
  ];
  if (
    privatePaths.some((path) => {
      const part = relative(config.frontendDirectory, path);
      return !part || (!part.startsWith("../") && part !== ".." && !isAbsolute(part));
    })
  )
    throw new Error("frontend_cannot_contain_private_state");
  return config;
};

export const readPrivate = async <T>(path: string): Promise<T> => {
  const info = await stat(path);
  if (!info.isFile() || (info.mode & 0o777) !== 0o600 || info.uid !== process.getuid?.())
    throw new Error("private_file_must_be_owned_0600");
  return JSON.parse(await readFile(path, "utf8")) as T;
};

export const privateWrite = async (path: string, value: unknown) => {
  await mkdir(resolve(path, ".."), { recursive: true, mode: 0o700 });
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", { mode: 0o600, flag: "wx" });
};

export const prepareState = async (config: StackConfig) => {
  await mkdir(config.stateDirectory, { recursive: true, mode: 0o700 });
  const info = await stat(config.stateDirectory);
  if (!info.isDirectory() || (info.mode & 0o777) !== 0o700 || info.uid !== process.getuid?.())
    throw new Error("owned_0700_state_directory_required");
  const name =
    "eternum-value-" +
    createHash("sha256").update(config.stateDirectory).digest("hex").slice(0, 12) +
    "-" +
    process.pid;
  return { directory: config.stateDirectory, container: name, pid: join(config.stateDirectory, "process.json") };
};
