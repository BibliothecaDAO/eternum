export type DynamicAddressSemanticKey = "account" | "factory" | "vrfProvider" | "world";

export type DynamicAddressInputKind = "environment" | "cli" | "runtime-field";

export interface DynamicAddressInputUse {
  readonly semanticKey: DynamicAddressSemanticKey;
  readonly sourceKey: string;
  readonly inputKind: DynamicAddressInputKind;
}

interface DynamicAddressRule {
  readonly semanticKey: DynamicAddressSemanticKey;
  readonly environmentPattern: RegExp;
  readonly cliFlag: string;
  readonly fieldPattern: RegExp;
}

const DYNAMIC_ADDRESS_RULES: readonly DynamicAddressRule[] = [
  addressRule("account", "ACCOUNT_ADDRESS", "accountAddress", "account_address", "--account-address"),
  addressRule("factory", "FACTORY_ADDRESS", "factoryAddress", "factory_address", "--factory-address"),
  addressRule(
    "vrfProvider",
    "VRF_PROVIDER_ADDRESS",
    "vrfProviderAddress",
    "vrf_provider_address",
    "--vrf-provider-address",
  ),
  addressRule("world", "WORLD_ADDRESS", "worldAddress", "world_address", "--world-address"),
];

export function discoverDynamicAddressInputUses(source: string): DynamicAddressInputUse[] {
  const uses = DYNAMIC_ADDRESS_RULES.flatMap((rule) => discoverRuleUses(source, rule));
  return uniqueUses(uses).sort(compareUses);
}

export function isDynamicAddressInputSourcePath(path: string): boolean {
  return (
    /\.(c?js|mjs|sh|c?ts|mts|tsx|py|rs|ya?ml)$/.test(path) &&
    !/(^|\/)(tests?|mocks?|target|node_modules)(\/|$)|\.test\.|\.gen\.ts$/.test(path) &&
    !path.includes("/generated/") &&
    !path.startsWith("packages/settlement-codec/") &&
    !path.startsWith("scripts/settlement/")
  );
}

function addressRule(
  semanticKey: DynamicAddressSemanticKey,
  environmentSuffix: string,
  camelField: string,
  snakeField: string,
  cliFlag: string,
): DynamicAddressRule {
  return {
    semanticKey,
    environmentPattern: new RegExp(`\\b((?:[A-Z][A-Z0-9_]*_)?${environmentSuffix})\\b`, "g"),
    cliFlag,
    fieldPattern: new RegExp(`\\b((?:[A-Za-z_$][\\w$]*\\.)*(?:${camelField}|${snakeField}))\\b`, "g"),
  };
}

function discoverRuleUses(source: string, rule: DynamicAddressRule): DynamicAddressInputUse[] {
  return [
    ...matchSourceKeys(source, rule.environmentPattern)
      .filter(isDynamicEnvironmentKey)
      .map((sourceKey) => dynamicUse(rule.semanticKey, sourceKey, "environment")),
    ...(source.includes(rule.cliFlag) ? [dynamicUse(rule.semanticKey, rule.cliFlag, "cli")] : []),
    ...matchSourceKeys(source, rule.fieldPattern).map((sourceKey) =>
      dynamicUse(rule.semanticKey, sourceKey, "runtime-field"),
    ),
  ];
}

function isDynamicEnvironmentKey(sourceKey: string): boolean {
  return !/^(?:CANONICAL|DEFAULT|EXPECTED)_/.test(sourceKey);
}

function matchSourceKeys(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function dynamicUse(
  semanticKey: DynamicAddressSemanticKey,
  sourceKey: string,
  inputKind: DynamicAddressInputKind,
): DynamicAddressInputUse {
  return { semanticKey, sourceKey, inputKind };
}

function uniqueUses(uses: readonly DynamicAddressInputUse[]): DynamicAddressInputUse[] {
  return [
    ...new Map(uses.map((use) => [`${use.semanticKey}:${use.inputKind}:${use.sourceKey}`, use] as const)).values(),
  ];
}

function compareUses(left: DynamicAddressInputUse, right: DynamicAddressInputUse): number {
  return (
    left.semanticKey.localeCompare(right.semanticKey) ||
    left.inputKind.localeCompare(right.inputKind) ||
    left.sourceKey.localeCompare(right.sourceKey)
  );
}
