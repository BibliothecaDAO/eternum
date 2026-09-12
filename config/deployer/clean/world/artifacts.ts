import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { byteArray, CallData, ec, hash, shortString, type Abi } from "starknet";
import { readClassArtifact } from "../shared/declare";
import type { ClassArtifact, LocalResource, LocalWorld, WorldProfile } from "./types";

const RESOURCE_INTERFACES = {
  "dojo::world::iworld::IWorld": "world",
  "dojo::contract::interface::IContract": "contract",
  "dojo::contract::interface::ILibrary": "library",
  "dojo::model::interface::IModel": "model",
  "dojo::event::interface::IEvent": "event",
} as const;

export function byteArrayHash(value: string): string {
  return hash.computePoseidonHashOnElements(CallData.compile(byteArray.byteArrayFromString(value)));
}

export function resourceSelector(namespace: string, name: string): string {
  return hash.computePoseidonHashOnElements([byteArrayHash(namespace), byteArrayHash(name)]);
}

export function readWorldProfile(path: string): WorldProfile {
  const value = Bun.TOML.parse(readFileSync(path, "utf8")) as unknown as WorldProfile;
  const supported = new Set(["namespace", "lib_versions", "env", "world", "writers", "init_call_args"]);
  for (const key of Object.keys(value))
    if (!supported.has(key)) throw new Error(`Unsupported world profile section: ${key}`);
  if (Object.keys(value.namespace ?? {}).some((key) => key !== "default"))
    throw new Error("Only the default namespace is supported");
  for (const [name, field] of Object.entries({
    namespace: value.namespace?.default,
    seed: value.world?.seed,
    name: value.world?.name,
  })) {
    if (typeof field !== "string" || !field) throw new Error(`World profile requires ${name}`);
  }
  if (!value.lib_versions || !value.writers) throw new Error("World profile requires lib_versions and writers");
  return value;
}

export function loadLocalWorld(artifactDirectory: string, profile: WorldProfile, address?: string): LocalWorld {
  const index = JSON.parse(readFileSync(resolve(artifactDirectory, "eternum.starknet_artifacts.json"), "utf8")) as {
    contracts: Array<{ artifacts: { sierra: string; casm: string } }>;
  };
  const resources: LocalResource[] = [];
  let world: LocalWorld["world"] | undefined;
  // The build index excludes stale artifacts left on disk by earlier builds.
  for (const entry of index.contracts) {
    const artifact = readClassArtifact(
      resolve(artifactDirectory, entry.artifacts.sierra),
      resolve(artifactDirectory, entry.artifacts.casm),
    );
    const identity = identifyResource(artifact.sierra.abi);
    if (!identity) throw new Error(`Unsupported non-world artifact: ${entry.artifacts.sierra}`);
    if (identity.kind === "world") {
      if (world) throw new Error("Build contains multiple World classes");
      world = artifact;
      continue;
    }
    resources.push(createLocalResource(artifact, { kind: identity.kind, name: identity.name }, profile));
  }
  if (!world) throw new Error("Build does not contain the World class");
  resources.sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));
  const salt = `0x${ec.starkCurve.poseidonHashSingle(BigInt(shortString.encodeShortString(profile.world.seed))).toString(16)}`;
  const result = {
    profile,
    world,
    resources,
    salt,
    address: address ?? hash.calculateContractAddressFromHash(salt, world.classHash, [], 0),
  };
  validateProfileResources(result);
  return result;
}

function identifyResource(abi: Abi) {
  for (const entry of abi) {
    if (entry.type !== "impl") continue;
    const kind = RESOURCE_INTERFACES[entry.interface_name as keyof typeof RESOURCE_INTERFACES];
    if (kind) return { kind, name: entry.name.split("__")[0] as string };
  }
}

export function externalEntrypoints(abi: Abi): string[] {
  return abi.flatMap((entry) =>
    entry.type === "interface"
      ? externalEntrypoints(entry.items)
      : entry.type === "function" && entry.state_mutability === "external"
        ? [entry.name]
        : [],
  );
}

function modelMembers(abi: Abi): LocalResource["members"] {
  const ensure = abi.find((entry) => entry.type === "function" && entry.name === "ensure_abi");
  const name = ensure?.inputs?.[0]?.type;
  const model = abi.find((entry) => entry.type === "struct" && entry.name === name);
  const values = abi.find((entry) => entry.type === "struct" && entry.name === `${name}Value`);
  if (!model || !values) throw new Error(`Missing model ABI/value struct: ${name}`);
  const valueNames = new Set(values.members.map((member: { name: string }) => member.name));
  return model.members.map((member: { name: string; type: string }) => ({
    ...member,
    key: !valueNames.has(member.name),
  }));
}

function validateProfileResources(local: LocalWorld) {
  const tags = new Map(local.resources.map((resource) => [resource.tag, resource]));
  if (tags.size !== local.resources.length) throw new Error("Duplicate resource tag in build");
  for (const [target, writers] of Object.entries(local.profile.writers)) {
    if (target !== local.profile.namespace.default && !tags.has(target))
      throw new Error(`Unknown writer resource: ${target}`);
    if (!Array.isArray(writers)) throw new Error(`Writers for ${target} must be an array`);
    for (const writer of writers)
      if (tags.get(writer)?.kind !== "contract") throw new Error(`Unknown writer contract: ${writer}`);
  }
  for (const tag of Object.keys(local.profile.init_call_args ?? {}))
    if (tags.get(tag)?.kind !== "contract") throw new Error(`Unknown init contract: ${tag}`);
}

function createLocalResource(
  artifact: ClassArtifact,
  identity: { kind: LocalResource["kind"]; name: string },
  profile: WorldProfile,
): LocalResource {
  const namespace = profile.namespace.default;
  const version = identity.kind === "library" ? profile.lib_versions[`${namespace}-${identity.name}`] : undefined;
  if (identity.kind === "library" && !version) throw new Error(`Missing library version: ${identity.name}`);
  const registeredName = version ? `${identity.name}_v${version}` : identity.name;
  const tag = `${namespace}-${registeredName}`;
  const initCalldata = profile.init_call_args?.[tag] ?? [];
  if (initCalldata.some((value) => !/^(0x[\da-fA-F]+|\d+)$/.test(value)))
    throw new Error(`Init calldata for ${tag} must contain encoded felts`);
  return {
    ...artifact,
    kind: identity.kind,
    name: identity.name,
    namespace,
    version,
    tag,
    selector: resourceSelector(namespace, registeredName),
    systems: externalEntrypoints(artifact.sierra.abi),
    members: identity.kind === "model" || identity.kind === "event" ? modelMembers(artifact.sierra.abi) : [],
    initCalldata,
  };
}
