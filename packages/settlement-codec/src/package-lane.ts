import packageLockMatrix from "../schema/package-lock-matrix-v1.json";

export type ProtocolPackageRole =
  | "dependency-leaf"
  | "protocol-consumer"
  | "dev-conformance"
  | "explicit-compatible"
  | "deferred-migration"
  | "legacy-nonconsumer";

export interface ProtocolPackage {
  id: string;
  packageName: string;
  packageVersion: string;
  edition: string | null;
  role: ProtocolPackageRole;
  cairoVersion: string | null;
  starknetVersion: string | null;
  scarbVersion: string | null;
  snforgeVersion: string | null;
  dependencies: string[];
  dependencyPins: Record<string, string>;
  resolvedDependencies: string[];
  internalDependencies: string[];
  prebuiltPlugins: string[];
  lockSha256: string;
  deferredTo?: string;
  releaseBlocking?: boolean;
}

export interface ProtocolPackageLane {
  schemaVersion: number;
  packages: ProtocolPackage[];
}

const alignedRoles = new Set<ProtocolPackageRole>([
  "dependency-leaf",
  "protocol-consumer",
  "dev-conformance",
  "explicit-compatible",
]);

export function getProtocolPackageLane(): ProtocolPackageLane {
  return structuredClone(packageLockMatrix) as unknown as ProtocolPackageLane;
}

export function validateProtocolPackageLane(lane: ProtocolPackageLane): void {
  const packagesById = indexPackages(lane.packages);
  validateProtocolLeaf(packagesById.get("settlement_protocol"));
  validateConsumers(lane.packages);
  validateDevConformance(lane.packages);
  validateAlignedLane(lane.packages);
  validateDeferredMigration(packagesById.get("season_resources"));
  validatePublishedPins(lane.packages);
  validateLockHashes(lane.packages);
  validateAcyclicDependencies(packagesById);
}

function validateAlignedLane(packages: ProtocolPackage[]): void {
  for (const packageEntry of packages.filter(({ role }) => alignedRoles.has(role))) {
    if (
      packageEntry.cairoVersion !== "2.13.1" ||
      packageEntry.starknetVersion !== "2.13.1" ||
      packageEntry.scarbVersion !== "2.13.1" ||
      packageEntry.snforgeVersion !== "0.51.2"
    ) {
      throw new Error(`${packageEntry.id} is outside the frozen 2.13.1/0.51.2 lane`);
    }
  }
}

function validatePublishedPins(packages: ProtocolPackage[]): void {
  for (const packageEntry of packages) {
    if (Object.keys(packageEntry.dependencyPins).sort().join(",") !== packageEntry.dependencies.join(",")) {
      throw new Error(`${packageEntry.id} does not publish every dependency pin`);
    }
    if (packageEntry.resolvedDependencies.join(",") !== packageEntry.dependencies.join(",")) {
      throw new Error(`${packageEntry.id} dependency aliases disagree with Scarb metadata`);
    }
  }
}

function indexPackages(packages: ProtocolPackage[]): Map<string, ProtocolPackage> {
  const packagesById = new Map<string, ProtocolPackage>();
  for (const packageEntry of packages) {
    if (packagesById.has(packageEntry.id)) throw new Error(`duplicate package id: ${packageEntry.id}`);
    packagesById.set(packageEntry.id, packageEntry);
  }
  return packagesById;
}

function validateProtocolLeaf(protocol: ProtocolPackage | undefined): void {
  if (!protocol || protocol.role !== "dependency-leaf")
    throw new Error("settlement_protocol must be the dependency leaf");
  if (protocol.internalDependencies.length > 0) {
    throw new Error("settlement_protocol must have no internal dependencies");
  }
  if (
    protocol.resolvedDependencies.some((dependency) => dependency === "dojo" || dependency.startsWith("openzeppelin"))
  ) {
    throw new Error("settlement_protocol must remain free of Dojo and OpenZeppelin");
  }
}

function validateConsumers(packages: ProtocolPackage[]): void {
  for (const packageEntry of packages.filter(({ role }) => role !== "dev-conformance")) {
    const importsProtocol = packageEntry.internalDependencies.includes("settlement_protocol");
    if (importsProtocol !== (packageEntry.role === "protocol-consumer")) {
      throw new Error(`${packageEntry.id} protocol-consumer role disagrees with its internal dependency graph`);
    }
  }
}

function validateDevConformance(packages: ProtocolPackage[]): void {
  const conformance = packages.find(({ role }) => role === "dev-conformance");
  if (!conformance) throw new Error("settlement integration conformance package is missing");
  const requiredDependencies = packages
    .filter(({ role }) => role === "dependency-leaf" || role === "protocol-consumer" || role === "explicit-compatible")
    .map(({ id }) => id)
    .sort();
  if (conformance.internalDependencies.join(",") !== requiredDependencies.join(",")) {
    throw new Error("settlement integration conformance package does not cover every aligned package");
  }
}

function validateDeferredMigration(seasonResources: ProtocolPackage | undefined): void {
  if (
    !seasonResources ||
    seasonResources.role !== "deferred-migration" ||
    seasonResources.deferredTo !== "C7" ||
    seasonResources.releaseBlocking !== true
  ) {
    throw new Error("season_resources must remain an explicit C7 release blocker");
  }
}

function validateLockHashes(packages: ProtocolPackage[]): void {
  for (const packageEntry of packages) {
    if (!/^[0-9a-f]{64}$/.test(packageEntry.lockSha256)) throw new Error(`${packageEntry.id} has no frozen lock hash`);
  }
}

function validateAcyclicDependencies(packagesById: Map<string, ProtocolPackage>): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(id: string): void {
    if (visiting.has(id)) throw new Error(`package dependency cycle includes ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependencyId of packagesById.get(id)?.internalDependencies ?? []) {
      if (packagesById.has(dependencyId)) visit(dependencyId);
    }
    visiting.delete(id);
    visited.add(id);
  }

  for (const id of packagesById.keys()) visit(id);
}
