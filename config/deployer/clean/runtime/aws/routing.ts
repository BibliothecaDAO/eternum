import type { DeploymentEnvironmentId } from "../../types";
import {
  buildAwsRuntimeTags,
  resolveRuntimeContainerPort,
  toAwsTagList,
  type AwsRuntimeCommandConfig,
  type AwsRuntimeConfigRequest,
} from "./config";
import {
  buildAwsCommandFailureMessage,
  buildAwsCommandOutput,
  commandOutputText,
  isMissingAwsCleanupOutput,
  isPriorityInUseOutput,
  parseJsonOutput,
  runOptionalAwsCleanupCommand,
  runRequiredAwsCommand,
  type AwsCommandRunner,
} from "./commands";
import {
  buildAwsRuntimeBasePath,
  buildAwsRuntimeServiceName,
  buildEndpointPath,
  buildTargetGroupName,
  resolveListenerRulePriority,
} from "./naming";

export interface AwsRuntimeRoutingRequest extends AwsRuntimeConfigRequest {
  environmentId: DeploymentEnvironmentId;
}

export function ensureTargetGroup(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRoutingRequest,
  config: AwsRuntimeCommandConfig,
): { targetGroupArn: string; adopted: boolean } {
  const targetGroupArn = resolveTargetGroupArnByName(commandRunner, request, config);

  if (targetGroupArn) {
    return { targetGroupArn, adopted: true };
  }

  return { targetGroupArn: createTargetGroup(commandRunner, request, config), adopted: false };
}

export function ensureListenerRule(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRoutingRequest,
  config: AwsRuntimeCommandConfig,
  targetGroupArn: string,
): boolean {
  if (resolveListenerRuleArn(commandRunner, request, config, targetGroupArn)) {
    return true;
  }

  createListenerRule(commandRunner, request, config, targetGroupArn);
  return false;
}

export function deleteListenerRuleIfPresent(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRoutingRequest,
  config: AwsRuntimeCommandConfig,
  targetGroupArn?: string,
): boolean {
  const ruleArn = resolveListenerRuleArn(commandRunner, request, config, targetGroupArn);
  if (!ruleArn) {
    return false;
  }

  runOptionalAwsCleanupCommand(commandRunner, `delete ALB listener rule for "${request.runtimeName}"`, [
    "elbv2",
    "delete-rule",
    "--region",
    config.region,
    "--rule-arn",
    ruleArn,
  ]);
  return true;
}

export function deleteTargetGroupIfPresent(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRoutingRequest,
  config: AwsRuntimeCommandConfig,
  targetGroupArn?: string,
): boolean {
  if (!targetGroupArn) {
    return false;
  }

  runOptionalAwsCleanupCommand(commandRunner, `delete target group for "${request.runtimeName}"`, [
    "elbv2",
    "delete-target-group",
    "--region",
    config.region,
    "--target-group-arn",
    targetGroupArn,
  ]);
  return true;
}

export function resolveTargetGroupArnByName(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRoutingRequest,
  config: AwsRuntimeCommandConfig,
): string | undefined {
  const result = commandRunner([
    "elbv2",
    "describe-target-groups",
    "--region",
    config.region,
    "--names",
    buildTargetGroupName(request),
    "--output",
    "json",
  ]);

  if ((result.status ?? 1) !== 0) {
    const output = buildAwsCommandOutput(result);
    if (isMissingAwsCleanupOutput(output)) {
      return undefined;
    }

    throw new Error(buildAwsCommandFailureMessage(`describe target group for "${request.runtimeName}"`, result));
  }

  const payload = parseJsonOutput<{ TargetGroups?: Array<Record<string, unknown>> }>(result.stdout || "", {});
  const targetGroupArn = payload.TargetGroups?.[0]?.TargetGroupArn;
  if (typeof targetGroupArn !== "string" || !targetGroupArn) {
    return undefined;
  }

  assertTargetGroupOwner(commandRunner, request, config, targetGroupArn);
  return targetGroupArn;
}

function createTargetGroup(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRoutingRequest,
  config: AwsRuntimeCommandConfig,
): string {
  const healthPath = buildEndpointPath(request.environmentId, request.runtimeName, request.runtimeKind, "health");
  const result = runRequiredAwsCommand(commandRunner, `create target group for "${request.runtimeName}"`, [
    "elbv2",
    "create-target-group",
    "--region",
    config.region,
    "--name",
    buildTargetGroupName(request),
    "--protocol",
    "HTTP",
    "--port",
    `${resolveRuntimeContainerPort(request.runtimeKind)}`,
    "--vpc-id",
    config.vpcId,
    "--target-type",
    "ip",
    "--health-check-enabled",
    "--health-check-protocol",
    "HTTP",
    "--health-check-path",
    healthPath,
    "--matcher",
    "HttpCode=200-399",
    "--tags",
    ...toAwsTagList(buildAwsRuntimeTags(request)),
    "--query",
    "TargetGroups[0].TargetGroupArn",
    "--output",
    "text",
  ]);

  return commandOutputText(result);
}

function createListenerRule(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRoutingRequest,
  config: AwsRuntimeCommandConfig,
  targetGroupArn: string,
): void {
  const basePath = buildAwsRuntimeBasePath(request);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const priority = allocateListenerRulePriority(commandRunner, request, config);
    const result = commandRunner(
      buildCreateListenerRuleArgs(request, config, {
        basePath,
        priority,
        targetGroupArn,
      }),
    );

    if ((result.status ?? 1) === 0) {
      return;
    }

    if (!shouldRetryListenerRulePriorityRace(result, attempt)) {
      throw new Error(buildAwsCommandFailureMessage(`create ALB listener rule for "${request.runtimeName}"`, result));
    }
  }

  throw new Error(`Unable to create ALB listener rule for "${request.runtimeName}" after priority retries`);
}

function buildCreateListenerRuleArgs(
  request: AwsRuntimeRoutingRequest,
  config: AwsRuntimeCommandConfig,
  options: {
    basePath: string;
    priority: number;
    targetGroupArn: string;
  },
): string[] {
  return [
    "elbv2",
    "create-rule",
    "--region",
    config.region,
    "--listener-arn",
    config.listenerArn,
    "--priority",
    `${options.priority}`,
    "--conditions",
    `Field=path-pattern,Values=${options.basePath},${options.basePath}/*`,
    "--actions",
    `Type=forward,TargetGroupArn=${options.targetGroupArn}`,
    "--tags",
    ...toAwsTagList(buildAwsRuntimeTags(request)),
  ];
}

function shouldRetryListenerRulePriorityRace(
  result: { stdout: string; stderr: string; status?: number },
  attempt: number,
): boolean {
  return attempt < 3 && isPriorityInUseOutput(buildAwsCommandOutput(result));
}

function allocateListenerRulePriority(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRoutingRequest,
  config: AwsRuntimeCommandConfig,
): number {
  const occupiedPriorities = listListenerRulePriorities(commandRunner, request, config);
  const basePriority = resolveListenerRulePriority(request);
  for (let priority = basePriority; priority <= 40_000; priority += 1) {
    if (!occupiedPriorities.has(priority)) {
      return priority;
    }
  }

  throw new Error(`Unable to allocate ALB listener rule priority for "${request.runtimeName}"`);
}

function listListenerRulePriorities(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRoutingRequest,
  config: AwsRuntimeCommandConfig,
): Set<number> {
  const result = runRequiredAwsCommand(commandRunner, `describe ALB listener rules for "${request.runtimeName}"`, [
    "elbv2",
    "describe-rules",
    "--region",
    config.region,
    "--listener-arn",
    config.listenerArn,
    "--output",
    "json",
  ]);
  const payload = parseJsonOutput<{ Rules?: Array<Record<string, unknown>> }>(result.stdout || "", {});

  return new Set(
    (payload.Rules || [])
      .map((rule) => Number(rule.Priority))
      .filter((priority) => Number.isInteger(priority) && priority > 0),
  );
}

function resolveListenerRuleArn(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRoutingRequest,
  config: AwsRuntimeCommandConfig,
  targetGroupArn?: string,
): string | undefined {
  const result = commandRunner([
    "elbv2",
    "describe-rules",
    "--region",
    config.region,
    "--listener-arn",
    config.listenerArn,
    "--output",
    "json",
  ]);

  if ((result.status ?? 1) !== 0) {
    const output = buildAwsCommandOutput(result);
    if (isMissingAwsCleanupOutput(output)) {
      return undefined;
    }

    throw new Error(buildAwsCommandFailureMessage(`describe ALB listener rules for "${request.runtimeName}"`, result));
  }

  const payload = parseJsonOutput<{ Rules?: Array<Record<string, unknown>> }>(result.stdout || "", {});
  const rules = payload.Rules || [];
  const pathRule = rules.find((candidate) => listenerRuleMatchesRuntimePath(candidate, request));
  if (pathRule) {
    assertListenerRuleOwner(commandRunner, request, config, pathRule);
    return readListenerRuleArn(pathRule);
  }

  const rule = rules.find(
    (candidate) =>
      listenerRuleForwardsToTargetGroup(candidate, targetGroupArn) &&
      listenerRuleIsOwnedByRuntime(commandRunner, request, config, candidate),
  );

  return rule ? readListenerRuleArn(rule) : undefined;
}

function listenerRuleMatchesRuntimePath(
  candidate: Record<string, unknown>,
  request: AwsRuntimeRoutingRequest,
): boolean {
  const conditions = Array.isArray(candidate.Conditions) ? (candidate.Conditions as Record<string, unknown>[]) : [];
  const expectedBasePath = buildAwsRuntimeBasePath(request);

  return conditions.some((condition) => {
    if (condition.Field !== "path-pattern") {
      return false;
    }

    const values = Array.isArray(condition.Values) ? condition.Values : [];
    return values.includes(expectedBasePath) || values.includes(`${expectedBasePath}/*`);
  });
}

function listenerRuleForwardsToTargetGroup(candidate: Record<string, unknown>, targetGroupArn?: string): boolean {
  if (!targetGroupArn) {
    return false;
  }

  const actions = Array.isArray(candidate.Actions) ? (candidate.Actions as Record<string, unknown>[]) : [];
  return actions.some((action) => action.TargetGroupArn === targetGroupArn);
}

function assertListenerRuleOwner(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRoutingRequest,
  config: AwsRuntimeCommandConfig,
  rule: Record<string, unknown>,
): void {
  const ruleArn = readListenerRuleArn(rule);
  if (!ruleArn) {
    return;
  }

  const owner = resolveTaggedRuntimeServiceName(commandRunner, request, config, ruleArn);
  const expectedOwner = buildAwsRuntimeServiceName(request);
  if (!owner || owner === expectedOwner) {
    return;
  }

  throw new Error(
    `AWS runtime listener rule "${ruleArn}" for ${buildAwsRuntimeBasePath(request)} belongs to "${owner}", expected "${expectedOwner}"`,
  );
}

function listenerRuleIsOwnedByRuntime(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRoutingRequest,
  config: AwsRuntimeCommandConfig,
  rule: Record<string, unknown>,
): boolean {
  const ruleArn = readListenerRuleArn(rule);
  if (!ruleArn) {
    return false;
  }

  const owner = resolveTaggedRuntimeServiceName(commandRunner, request, config, ruleArn);
  return !owner || owner === buildAwsRuntimeServiceName(request);
}

function readListenerRuleArn(rule: Record<string, unknown>): string | undefined {
  const ruleArn = rule.RuleArn;
  return typeof ruleArn === "string" && ruleArn ? ruleArn : undefined;
}

function assertTargetGroupOwner(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRoutingRequest,
  config: AwsRuntimeCommandConfig,
  targetGroupArn: string,
): void {
  const owner = resolveTaggedRuntimeServiceName(commandRunner, request, config, targetGroupArn);
  const expectedOwner = buildAwsRuntimeServiceName(request);
  if (!owner || owner === expectedOwner) {
    return;
  }

  throw new Error(
    `AWS runtime target group "${targetGroupArn}" for ${buildAwsRuntimeBasePath(request)} belongs to "${owner}", expected "${expectedOwner}"`,
  );
}

function resolveTaggedRuntimeServiceName(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRoutingRequest,
  config: AwsRuntimeCommandConfig,
  resourceArn: string,
): string | undefined {
  const result = runRequiredAwsCommand(commandRunner, `describe ALB resource tags for "${request.runtimeName}"`, [
    "elbv2",
    "describe-tags",
    "--region",
    config.region,
    "--resource-arns",
    resourceArn,
    "--output",
    "json",
  ]);
  const payload = parseJsonOutput<{
    TagDescriptions?: Array<{ ResourceArn?: string; Tags?: Array<{ Key?: string; Value?: string }> }>;
  }>(result.stdout || "", {});
  const tagDescriptions = payload.TagDescriptions ?? [];
  const tagDescription = tagDescriptions.some((description) => description.ResourceArn)
    ? tagDescriptions.find((description) => description.ResourceArn === resourceArn)
    : tagDescriptions[0];
  return tagDescription?.Tags?.find((tag) => tag.Key === "RuntimeServiceName")?.Value;
}
