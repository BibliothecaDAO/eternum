import { hash } from "starknet";

export function buildRegistryCommitment(registry) {
  const registryPreimage = [
    hash.getSelectorFromName("ETERNUM_SCHEMA_REGISTRY_V1"),
    registry.protocolVersion,
    hashRecord("SCHEMA_SERIALIZATION_V1", registry.serialization),
    registry.declarations.length,
    ...registry.declarations.map((declaration) => hashRecord("SCHEMA_DECLARATION_V1", declaration)),
    registry.actions.length,
    ...registry.actions.map((action) => hashRecord("SCHEMA_ACTION_V1", action)),
    registry.claimKinds.length,
    ...registry.claimKinds.map((claimKind) => hashRecord("SCHEMA_CLAIM_KIND_V1", claimKind)),
    registry.hashDomains.length,
    ...registry.hashDomains.map(hash.getSelectorFromName),
    registry.bounds.length,
    ...registry.bounds.map((bound) => hashRecord("SCHEMA_BOUND_V1", bound)),
    registry.trees.length,
    ...registry.trees.map(hashTreeSchema),
  ];

  return {
    registryPreimage,
    schemaRegistryHash: hash.computePoseidonHashOnElements(registryPreimage),
  };
}

export function assertRegistryCommitment(registry) {
  const rebuilt = buildRegistryCommitment(registry);
  if (JSON.stringify(rebuilt.registryPreimage) !== JSON.stringify(registry.registryPreimage)) {
    throw new Error("schema registry preimage does not bind the complete canonical registry");
  }
  if (rebuilt.schemaRegistryHash !== registry.schemaRegistryHash) {
    throw new Error("schema registry hash does not match its canonical preimage");
  }
}

export function assertRegistryCommitmentCoverage(registry) {
  const expected = buildRegistryCommitment(registry).schemaRegistryHash;
  const mutations = [
    (candidate) => (candidate.serialization.__commitmentProbe = true),
    (candidate) => (candidate.declarations[0].name += "CommitmentProbe"),
    (candidate) => (candidate.actions[0].code += 1),
    (candidate) => (candidate.claimKinds[0].code += 1),
    (candidate) => (candidate.hashDomains[0] += "_COMMITMENT_PROBE"),
    (candidate) => (candidate.bounds[0].maximum += "0"),
    (candidate) => (candidate.trees[0].depth += 1),
  ];

  for (const mutate of mutations) {
    const candidate = structuredClone(registry);
    mutate(candidate);
    if (buildRegistryCommitment(candidate).schemaRegistryHash === expected) {
      throw new Error("schema registry commitment omits a canonical registry section");
    }
  }
}

function hashRecord(domain, record) {
  return hash.computePoseidonHashOnElements([
    hash.getSelectorFromName(domain),
    hash.getSelectorFromName(canonicalJson(record)),
  ]);
}

function hashTreeSchema(tree) {
  return hash.computePoseidonHashOnElements([
    hash.getSelectorFromName(tree.name),
    tree.depth,
    tree.capacity,
    hash.getSelectorFromName(tree.leafDomain),
    hash.getSelectorFromName(tree.emptyLeafDomain),
    hash.getSelectorFromName(tree.nodeDomain),
  ]);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
