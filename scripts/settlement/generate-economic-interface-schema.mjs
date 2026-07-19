import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const economicInterfacePath = resolve(repositoryRoot, "contracts/settlement_protocol/src/economic_interfaces.cairo");
const protocolInterfacesPath = resolve(repositoryRoot, "contracts/settlement_protocol/src/interfaces.cairo");
const registryPath = resolve(repositoryRoot, "packages/settlement-codec/schema/economic-capability-registry-v1.json");
const outputPath = resolve(repositoryRoot, "packages/settlement-codec/schema/economic-interface-schema-v1.json");
const checkOnly = process.argv.includes("--check");

const [economicSource, protocolSource, registrySource] = await Promise.all([
  readFile(economicInterfacePath, "utf8"),
  readFile(protocolInterfacesPath, "utf8"),
  readFile(registryPath, "utf8"),
]);
const registry = JSON.parse(registrySource);
const schema = buildEconomicInterfaceSchema(economicSource);

validateRegistryAgainstEconomicInterface(registry, schema);
validateCallbacksAgainstCanonicalInterface(registry, protocolSource, schema);
await publishOrCheck(schema);

function buildEconomicInterfaceSchema(source) {
  const declarations = parseDeclarations(source);
  const interfaceDeclaration = parseTrait(source, "IEconomicStateSystem");
  return {
    schemaVersion: 1,
    source: "contracts/settlement_protocol/src/economic_interfaces.cairo",
    sourceSha256: createHash("sha256").update(source).digest("hex"),
    declarations,
    interface: interfaceDeclaration,
  };
}

function parseDeclarations(source) {
  const declarations = [];
  const declarationPattern = /pub (enum|struct) ([A-Za-z0-9_]+)\s*\{/g;
  for (const match of source.matchAll(declarationPattern)) {
    const body = readBracedBody(source, match.index + match[0].length - 1);
    declarations.push({
      kind: match[1],
      name: match[2],
      members: splitTopLevel(body, ",")
        .filter(Boolean)
        .map((member) => parseMember(match[1], member)),
    });
  }
  return declarations;
}

function parseMember(kind, source) {
  const normalized = normalizeSignature(source).replace(/^pub /, "");
  if (kind === "enum") return { name: normalized };
  const separator = normalized.indexOf(":");
  if (separator < 1) throw new Error(`invalid economic struct member: ${source}`);
  return { name: normalized.slice(0, separator), type: normalized.slice(separator + 1) };
}

function parseTrait(source, name) {
  const marker = new RegExp(`pub trait ${name}(?:<[^>]+>)?\\s*\\{`).exec(source);
  if (!marker) throw new Error(`missing Cairo trait: ${name}`);
  const body = readBracedBody(source, marker.index + marker[0].length - 1);
  return {
    name,
    methods: splitTopLevel(body, ";")
      .filter(Boolean)
      .map((signature) => {
        const normalized = normalizeSignature(signature);
        const method = /^fn ([a-z0-9_]+)/.exec(normalized)?.[1];
        if (!method) throw new Error(`invalid Cairo interface method: ${signature}`);
        return { name: method, signature: `${normalized};` };
      }),
  };
}

function validateRegistryAgainstEconomicInterface(capabilityRegistry, schema) {
  const declarations = new Map(schema.declarations.map((declaration) => [declaration.name, declaration]));
  const methods = new Map(schema.interface.methods.map((method) => [method.name, method.signature]));
  const families = new Map(capabilityRegistry.families.map((family) => [family.id, family]));

  for (const family of capabilityRegistry.families) {
    const request = declarations.get(family.requestType);
    const signature = methods.get(family.method);
    if (!request || request.kind !== "struct") throw new Error(`${family.id} has no exact request declaration`);
    if (!signature?.includes(`request:${family.requestType}`) || !signature.endsWith(`->${family.resultType};`)) {
      throw new Error(`${family.id} does not match the frozen economic method signature: ${signature}`);
    }
    validateFamilyActions(family, request, declarations);
  }

  for (const operation of capabilityRegistry.operations.filter(({ family }) => family !== "settlement_callback")) {
    const family = families.get(operation.family);
    if (!family || operation.requestType !== family.requestType || operation.resultType !== family.resultType) {
      throw new Error(`${operation.name} disagrees with its frozen economic family`);
    }
  }
}

function validateFamilyActions(family, request, declarations) {
  const actionField = request.members.find(({ name }) => name === "action");
  if (!actionField) throw new Error(`${family.id} request has no action field`);
  const actionDeclaration = declarations.get(actionField.type);
  if (!actionDeclaration || actionDeclaration.kind !== "enum") {
    throw new Error(`${family.id} action field does not resolve to an enum`);
  }
  const actions = actionDeclaration.members.map(({ name }) => toSnakeCase(name));
  if (actions.join(",") !== family.actions.join(",")) throw new Error(`${family.id} action variants drifted`);
}

function validateCallbacksAgainstCanonicalInterface(capabilityRegistry, protocolSource, economicSchema) {
  const callbackOperations = capabilityRegistry.operations.filter(({ family }) => family === "settlement_callback");
  const callbackInterface = parseTrait(protocolSource, "IGameEconomicSettlementCallbacks");
  const methods = new Map(callbackInterface.methods.map((method) => [method.name, method.signature]));
  const economicNames = new Set([
    ...economicSchema.declarations.map(({ name }) => name),
    ...economicSchema.interface.methods.map(({ name }) => name),
  ]);

  for (const operation of callbackOperations) {
    if (operation.interfaceTrait !== callbackInterface.name || operation.requestType !== null) {
      throw new Error(`${operation.name} must use the canonical callback trait without a parallel request type`);
    }
    const expectedParameters = operation.parameters.map(({ name, type }) => `${name}:${type}`).join(",");
    const signature = methods.get(operation.method);
    if (!signature?.includes(`ref self:TContractState,${expectedParameters})`)) {
      throw new Error(`${operation.name} callback parameters drifted: ${signature}`);
    }
    if (!signature.endsWith(`->${operation.resultType};`)) throw new Error(`${operation.name} callback result drifted`);
    if (economicNames.has(operation.method)) throw new Error(`${operation.name} is duplicated in the economic trait`);
  }

  for (const staleType of ["AssignOpenBatchRequest", "PromoteSealedBatchRequest", "SettlementCallbackRequest"]) {
    if (economicNames.has(staleType)) throw new Error(`parallel callback type remains: ${staleType}`);
  }
}

function readBracedBody(source, openingBrace) {
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(openingBrace + 1, index);
  }
  throw new Error("unterminated Cairo declaration");
}

function splitTopLevel(source, delimiter) {
  const members = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    if ("<({[".includes(source[index])) depth += 1;
    if (")}]".includes(source[index]) || (source[index] === ">" && source[index - 1] !== "-")) {
      depth -= 1;
    }
    if (source[index] === delimiter && depth === 0) {
      members.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  members.push(source.slice(start).trim());
  return members;
}

function normalizeSignature(source) {
  return source
    .replaceAll(/\/\/[^\n]*/g, "")
    .replaceAll(/\s+/g, " ")
    .replaceAll(/\s*([,:<>()@])\s*/g, "$1")
    .replaceAll(",)", ")")
    .trim();
}

function toSnakeCase(value) {
  return value.replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

async function publishOrCheck(value) {
  const generated = `${JSON.stringify(value, null, 2)}\n`;
  if (!checkOnly) {
    await writeFile(outputPath, generated);
    return;
  }
  const committed = await readFile(outputPath, "utf8");
  if (committed !== generated) {
    throw new Error("economic interface schema is stale; run pnpm run generate:economic-interface-schema");
  }
}
