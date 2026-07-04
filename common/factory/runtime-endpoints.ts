export type RuntimeKind = "katana" | "torii";
export type RuntimeEndpointKind = "base" | "health" | "rpc" | "sql";

export function normalizeRuntimeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function buildRuntimeBasePath(environmentId: string, runtimeName: string, runtimeKind: RuntimeKind): string {
  return `/x/${normalizeRuntimeSegment(environmentId)}/${normalizeRuntimeSegment(runtimeName)}/${runtimeKind}`;
}

export function buildRuntimeEndpointPath(
  environmentId: string,
  runtimeName: string,
  runtimeKind: RuntimeKind,
  endpointKind: RuntimeEndpointKind,
): string {
  const basePath = buildRuntimeBasePath(environmentId, runtimeName, runtimeKind);

  if (endpointKind === "base") {
    return basePath;
  }

  if (runtimeKind === "katana" && endpointKind === "rpc") {
    return `${basePath}/rpc/v0_9`;
  }

  return `${basePath}/${endpointKind}`;
}

export function buildRuntimeEndpointUrl(
  domain: string,
  environmentId: string,
  runtimeName: string,
  runtimeKind: RuntimeKind,
  endpointKind: RuntimeEndpointKind,
): string {
  return `https://${domain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}${buildRuntimeEndpointPath(
    environmentId,
    runtimeName,
    runtimeKind,
    endpointKind,
  )}`;
}
