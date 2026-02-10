import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const APP_NAME = "axis";

const REQUIRED_STAGED_FILES = [
  APP_NAME,
  "package.json",
  "README.md",
  "LICENSE",
  ".env.example",
  "data/soul.md",
  "data/HEARTBEAT.md",
  "data/tasks/priorities.md",
];

export interface ReleasePackagingOptions {
  packageDir: string;
  outputDir: string;
  targets: string[];
  version: string;
  skipBuild?: boolean;
  binaryPath?: string;
  licensePath?: string;
}

export interface ReleasePackagingResult {
  archives: string[];
  checksumsPath: string;
}

export interface LayoutValidationResult {
  ok: boolean;
  missing: string[];
}

function normalizeVersion(version: string): string {
  return version.startsWith("v") ? version.slice(1) : version;
}

function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

function hashFileSha256(filePath: string): string {
  const data = readFileSync(filePath);
  return createHash("sha256").update(data).digest("hex");
}

function buildTargetBinary(packageDir: string, target: string, outputPath: string): void {
  execFileSync("bun", ["build", "src/cli.ts", "--compile", "--target", `bun-${target}`, "--outfile", outputPath], {
    cwd: packageDir,
    stdio: "inherit",
  });
}

function resolveBinaryForTarget(options: ReleasePackagingOptions, target: string, tempDir: string): string {
  if (options.skipBuild) {
    if (!options.binaryPath) {
      throw new Error("binaryPath is required when skipBuild=true");
    }
    return options.binaryPath;
  }

  const builtBinaryPath = path.join(tempDir, `${APP_NAME}-${target}`);
  buildTargetBinary(options.packageDir, target, builtBinaryPath);
  return builtBinaryPath;
}

function stageCommonFiles(stageDir: string, options: ReleasePackagingOptions): void {
  const packageJsonPath = path.join(options.packageDir, "package.json");
  const readmePath = path.join(options.packageDir, "README.md");
  const envExamplePath = path.join(options.packageDir, ".env.example");
  const dataDirPath = path.join(options.packageDir, "data");
  const resolvedLicensePath = options.licensePath ?? path.resolve(options.packageDir, "../../../LICENSE");

  cpSync(packageJsonPath, path.join(stageDir, "package.json"));
  cpSync(readmePath, path.join(stageDir, "README.md"));
  cpSync(envExamplePath, path.join(stageDir, ".env.example"));
  cpSync(resolvedLicensePath, path.join(stageDir, "LICENSE"));
  cpSync(dataDirPath, path.join(stageDir, "data"), { recursive: true });
}

function createArchive(archivePath: string, sourceRoot: string): void {
  execFileSync("tar", ["-czf", archivePath, "-C", sourceRoot, APP_NAME], {
    env: {
      ...process.env,
      LANG: "C",
      LC_ALL: "C",
    },
  });
}

function stageAndPackageTarget(options: ReleasePackagingOptions, target: string, workingDir: string): string {
  const binarySource = resolveBinaryForTarget(options, target, workingDir);
  const stageRoot = path.join(workingDir, `stage-${target}`);
  const stageDir = path.join(stageRoot, APP_NAME);
  ensureDir(stageDir);

  cpSync(binarySource, path.join(stageDir, APP_NAME));
  chmodSync(path.join(stageDir, APP_NAME), 0o755);
  stageCommonFiles(stageDir, options);

  const validation = validateStagedReleaseLayout(stageDir);
  if (!validation.ok) {
    throw new Error(`Staged layout missing required files for ${target}: ${validation.missing.join(", ")}`);
  }

  const archivePath = path.join(options.outputDir, getArchiveFileName(target, options.version));
  createArchive(archivePath, stageRoot);
  return archivePath;
}

export function getArchiveFileName(target: string, version: string): string {
  return `${APP_NAME}-v${normalizeVersion(version)}-${target}.tar.gz`;
}

export function validateStagedReleaseLayout(stageDir: string): LayoutValidationResult {
  const missing = REQUIRED_STAGED_FILES.filter((relativePath) => !existsSync(path.join(stageDir, relativePath)));
  return {
    ok: missing.length === 0,
    missing,
  };
}

export async function runReleasePackaging(options: ReleasePackagingOptions): Promise<ReleasePackagingResult> {
  ensureDir(options.outputDir);
  const workingDir = mkdtempSync(path.join(tmpdir(), "onchain-release-"));

  try {
    const archives: string[] = [];
    const checksums: string[] = [];

    for (const target of options.targets) {
      const archivePath = stageAndPackageTarget(options, target, workingDir);
      archives.push(archivePath);
      checksums.push(`${hashFileSha256(archivePath)}  ${path.basename(archivePath)}`);
    }

    const checksumsPath = path.join(options.outputDir, "checksums.txt");
    writeFileSync(checksumsPath, checksums.join("\n") + "\n", "utf8");

    return {
      archives,
      checksumsPath,
    };
  } finally {
    rmSync(workingDir, { recursive: true, force: true });
  }
}
