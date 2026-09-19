import { execFileSync } from "node:child_process";
import path from "node:path";

const serviceWorkspaces = {
  herald: ["apps/herald"],
  "realms-identity": ["apps/realms"],
  // The launch runner imports config directly, outside its package manifest.
  "realms-launch": ["apps/launch-service", "config"],
  "realms-chat": ["apps/realtime-server"],
};

function readRevision(revision, file) {
  return execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
}

function dependencyInputs(lock, roots) {
  const workspaces = new Set();
  const packages = new Map();

  function visitDependencies(dependencies, workspace) {
    for (const [name, entry] of Object.entries(dependencies ?? {})) {
      const version = typeof entry === "string" ? entry : entry.version;
      if (version.startsWith("link:")) {
        visitWorkspace(path.posix.normalize(path.posix.join(workspace, version.slice(5))));
      } else {
        visitPackage(name, version);
      }
    }
  }

  function visitWorkspace(workspace) {
    if (workspaces.has(workspace)) return;
    const importer = lock.importers[workspace];
    if (!importer) throw new Error(`Missing deploy workspace: ${workspace}`);
    workspaces.add(workspace);
    packages.set(`workspace:${workspace}`, importer);
    for (const field of ["dependencies", "devDependencies", "optionalDependencies"]) {
      visitDependencies(importer[field], workspace);
    }
  }

  function visitPackage(name, version) {
    // pnpm records npm aliases as a complete package@version reference.
    const key = lock.snapshots[`${name}@${version}`] ? `${name}@${version}` : version;
    if (packages.has(key)) return;
    const snapshot = lock.snapshots[key];
    if (!snapshot) throw new Error(`Missing deploy dependency: ${key}`);
    packages.set(key, [snapshot, lock.packages[key.split("(")[0]]]);
    visitDependencies(snapshot.dependencies);
    visitDependencies(snapshot.optionalDependencies);
  }

  // Root tools participate in the shared-package build.
  for (const workspace of [".", ...roots]) visitWorkspace(workspace);
  return { workspaces, fingerprint: JSON.stringify([...packages].sort(([a], [b]) => a.localeCompare(b))) };
}

function buildDeploymentPlan(from, to) {
  if (!from) return { services: Object.keys(serviceWorkspaces), buildShared: true };
  const changed = execFileSync("git", ["diff", "--name-only", from, to], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);
  const before = Bun.YAML.parse(readRevision(from, "pnpm-lock.yaml"));
  const after = Bun.YAML.parse(readRevision(to, "pnpm-lock.yaml"));
  const services = [];
  let buildShared = false;
  for (const [service, roots] of Object.entries(serviceWorkspaces)) {
    const previous = dependencyInputs(before, roots);
    const current = dependencyInputs(after, roots);
    const dependencyChange = previous.fingerprint !== current.fingerprint || changed.includes("package.json");
    const workspaces = new Set([...previous.workspaces, ...current.workspaces]);
    workspaces.delete(".");
    const affectedFiles = changed.filter((file) => [...workspaces].some((workspace) => file.startsWith(`${workspace}/`)));
    if (dependencyChange || affectedFiles.length > 0) services.push(service);
    if (dependencyChange || affectedFiles.some((file) => file.startsWith("packages/"))) buildShared = true;
  }
  return { services, buildShared };
}

try {
  console.log(JSON.stringify(buildDeploymentPlan(process.argv[2], process.argv[3])));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
