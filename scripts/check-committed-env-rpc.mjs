#!/usr/bin/env node
// A committed env file never names a third-party RPC: a public node shipped as a default is rate-limited and fails
// sign-in under load, and a keyed one is a leaked secret. An RPC key in a committed env file may be empty, one of our
// own hosts, a placeholder or a loopback address; the real URL lives in .env.local or a deployment secret.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const ALLOWED_HOST =
  /(^|\.)realms\.party$|\.example$|\.test$|^localhost$|^127\.0\.0\.1$|^\[::1\]$|^host\.docker\.internal$/;

/** Every `KEY=https://…` line whose key names an RPC and whose host is someone else's node. */
export function findCommittedRpcUrls(files) {
  return files.flatMap(({ path, text }) =>
    text.split("\n").flatMap((line, index) => {
      const match = /^\s*(?:export\s+)?([A-Z0-9_]*RPC[A-Z0-9_]*)\s*=\s*["']?(https?:\/\/[^\s"']+)/.exec(line);
      if (!match) return [];
      const host = new URL(match[2]).hostname;
      return ALLOWED_HOST.test(host) ? [] : [{ path, line: index + 1, key: match[1], url: match[2] }];
    }),
  );
}

const committedEnvFiles = () =>
  execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter((path) => /(^|\/)\.env($|\.)/.test(path) && !path.includes("node_modules/"))
    .map((path) => ({ path, text: readFileSync(path, "utf8") }));

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const findings = findCommittedRpcUrls(committedEnvFiles());
  for (const { path, line, key, url } of findings) {
    console.error(`${path}:${line} ${key}=${url} names a third-party RPC; keep it in .env.local or a secret`);
  }
  if (findings.length > 0) process.exit(1);
  console.log("committed env files name no third-party RPC");
}
