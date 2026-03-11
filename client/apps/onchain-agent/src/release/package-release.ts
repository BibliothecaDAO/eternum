import path from "node:path";
import { readFileSync } from "node:fs";
import { runReleasePackaging } from "./packager";

const DEFAULT_TARGETS = ["darwin-arm64", "darwin-x64", "linux-x64", "linux-arm64"];

interface PackageJson {
  version?: string;
}

function parseArgs(args: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--") continue;
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = args[i + 1];
    if (!value || value.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = value;
    i += 1;
  }
  return parsed;
}

function readVersion(packageDir: string): string {
  const raw = readFileSync(path.join(packageDir, "package.json"), "utf8");
  const parsed = JSON.parse(raw) as PackageJson;
  if (!parsed.version) {
    throw new Error("package.json is missing version");
  }
  return parsed.version;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const packageDir = process.cwd();
  const outputDir = path.resolve(packageDir, String(args.outDir ?? "release"));
  const version = String(args.version ?? readVersion(packageDir));
  const targets = String(args.targets ?? DEFAULT_TARGETS.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const skipBuild = args.skipBuild === true || process.env.SKIP_BUILD === "1";
  const binaryPath = typeof args.binaryPath === "string" ? path.resolve(packageDir, args.binaryPath) : undefined;
  const licensePath = typeof args.licensePath === "string" ? path.resolve(packageDir, args.licensePath) : undefined;

  const result = await runReleasePackaging({
    packageDir,
    outputDir,
    targets,
    version,
    skipBuild,
    binaryPath,
    licensePath,
  });

  console.log(`Packaged ${result.archives.length} artifact(s):`);
  for (const archive of result.archives) {
    console.log(`- ${archive}`);
  }
  console.log(`Checksums: ${result.checksumsPath}`);
}

main().catch((error) => {
  console.error("Release packaging failed:", error);
  process.exit(1);
});
