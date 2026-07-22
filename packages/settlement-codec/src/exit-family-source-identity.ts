import economicInterfaceSchemaJson from "../schema/economic-interface-schema-v1.json";
import { encodeSchema, type SchemaValue } from "./codec";

export interface ExitFamilyInterfaceMemberReference {
  declaration: string;
  member: string;
}

export interface ExitFamilySourceModelReference {
  path: string;
  model: string;
  members: string[];
}

export interface ExitFamilySourceIdentityField {
  name: string;
  type: string | null;
  interfaceMembers: ExitFamilyInterfaceMemberReference[];
}

export interface ExitFamilySourceIdentityPolicy {
  fields: ExitFamilySourceIdentityField[];
  status: "interface-reviewed" | "unresolved";
  sourceModels: ExitFamilySourceModelReference[];
  unresolvedReason: string | null;
}

export type ExitFamilyReleaseBlockerScope = "all-families" | "unresolved-source-identities" | "global";

interface ExitFamilyIdentityStatus {
  familyId: number;
  sourceIdentity: Pick<ExitFamilySourceIdentityPolicy, "status">;
}

interface EconomicInterfaceDeclaration {
  name: string;
  members?: Array<{ name: string; type: string | null } | string>;
}

const ECONOMIC_INTERFACE_DECLARATIONS = new Map(
  (economicInterfaceSchemaJson.declarations as EconomicInterfaceDeclaration[]).map((declaration) => [
    declaration.name,
    declaration,
  ]),
);

export function validateExitFamilySourceIdentityPolicy(
  familyId: number,
  identity: ExitFamilySourceIdentityPolicy,
): void {
  requireUniqueIdentityFields(familyId, identity.fields);
  validateInterfaceMemberReferences(familyId, identity.fields);
  validateSourceModelReferences(familyId, identity.sourceModels);

  if (identity.status === "interface-reviewed") return validateInterfaceBackedIdentity(familyId, identity);
  if (identity.status === "unresolved") return validateUnresolvedIdentity(familyId, identity);
  throw new Error(`exit family ${familyId} has unknown source identity status: ${String(identity.status)}`);
}

export function validateExitFamilySourceModelEvidence(
  familyId: number,
  references: ExitFamilySourceModelReference[],
  loadSource: (path: string) => string,
): void {
  for (const reference of references) {
    const modelBody = extractCairoStructBody(loadSource(reference.path), reference.model);
    for (const member of reference.members) {
      if (!cairoStructBodyHasMember(modelBody, member)) {
        throw new Error(`exit family ${familyId} source model evidence is stale: ${reference.model}.${member}`);
      }
    }
  }
}

export function resolveExitFamilyReleaseBlockerFamilyIds(
  scope: ExitFamilyReleaseBlockerScope,
  families: readonly ExitFamilyIdentityStatus[],
): number[] {
  if (scope === "all-families") return families.map(({ familyId }) => familyId);
  if (scope === "unresolved-source-identities") {
    return families
      .filter(({ sourceIdentity }) => sourceIdentity.status === "unresolved")
      .map(({ familyId }) => familyId);
  }
  if (scope === "global") return [];
  throw new Error(`unknown exit-family release-blocker scope: ${String(scope)}`);
}

export function validateExitFamilySourceIdentityCandidateValue(
  familyId: number,
  identity: ExitFamilySourceIdentityPolicy,
  value: Readonly<Record<string, SchemaValue>>,
): void {
  if (identity.status === "unresolved") {
    throw new Error(`family ${familyId} typed source identity is unresolved: ${identity.unresolvedReason}`);
  }
  if (identity.status !== "interface-reviewed") {
    throw new Error(`family ${familyId} has unknown source identity status: ${String(identity.status)}`);
  }

  const expectedFields = identity.fields.map(({ name }) => name).toSorted();
  const actualFields = Object.keys(value).toSorted();
  if (JSON.stringify(actualFields) !== JSON.stringify(expectedFields)) {
    throw new Error(`family ${familyId} source identity fields do not match its frozen schema`);
  }

  for (const field of identity.fields) {
    if (!field.type) throw new Error(`family ${familyId} source identity field ${field.name} has no frozen type`);
    encodeSchema(field.type, value[field.name]);
  }
}

function requireUniqueIdentityFields(familyId: number, fields: ExitFamilySourceIdentityField[]): void {
  if (fields.length === 0) throw new Error(`exit family ${familyId} source identity has no fields`);
  const names = fields.map(({ name }) => name);
  if (new Set(names).size !== names.length) {
    throw new Error(`exit family ${familyId} source identity fields are duplicated`);
  }
}

function validateInterfaceMemberReferences(familyId: number, fields: ExitFamilySourceIdentityField[]): void {
  for (const field of fields) {
    for (const reference of field.interfaceMembers) {
      const declaration = ECONOMIC_INTERFACE_DECLARATIONS.get(reference.declaration);
      const member = declaration?.members?.find(
        (candidate) => typeof candidate !== "string" && candidate.name === reference.member,
      );
      if (!member || typeof member === "string") {
        throw new Error(
          `exit family ${familyId} source identity evidence is not in the frozen ABI: ${reference.declaration}.${reference.member}`,
        );
      }
      if (field.type !== member.type) {
        throw new Error(
          `exit family ${familyId} source identity type disagrees with ${reference.declaration}.${reference.member}`,
        );
      }
    }
  }
}

function validateSourceModelReferences(familyId: number, references: ExitFamilySourceModelReference[]): void {
  for (const reference of references) {
    if (!reference.path || !reference.model || reference.members.length === 0) {
      throw new Error(`exit family ${familyId} source model evidence is incomplete`);
    }
  }
}

function extractCairoStructBody(source: string, model: string): string {
  const declaration = new RegExp(`pub\\s+struct\\s+${escapeRegExp(model)}\\s*\\{([\\s\\S]*?)\\n\\}`, "m").exec(source);
  if (!declaration) throw new Error(`source model evidence does not declare ${model}`);
  return declaration[1];
}

function cairoStructBodyHasMember(body: string, member: string): boolean {
  return new RegExp(`(?:^|\\n)\\s*(?:pub\\s+)?${escapeRegExp(member)}\\s*:`, "m").test(body);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateInterfaceBackedIdentity(familyId: number, identity: ExitFamilySourceIdentityPolicy): void {
  if (
    identity.unresolvedReason !== null ||
    identity.fields.some(({ type, interfaceMembers }) => !type || interfaceMembers.length === 0)
  ) {
    throw new Error(`exit family ${familyId} reviewed source identity is incomplete`);
  }
}

function validateUnresolvedIdentity(familyId: number, identity: ExitFamilySourceIdentityPolicy): void {
  if (!identity.unresolvedReason || identity.fields.every(({ type }) => type !== null)) {
    throw new Error(`exit family ${familyId} unresolved source identity lacks a precise blocker`);
  }
}
