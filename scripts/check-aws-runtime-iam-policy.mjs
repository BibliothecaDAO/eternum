import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const runtimeSourcePath = process.env.AWS_RUNTIME_IAM_RUNTIME_SOURCE ?? "config/deployer/clean/runtime";
const resourceAuditSourcePath =
  process.env.AWS_RUNTIME_IAM_RESOURCE_AUDIT_SOURCE ?? "scripts/check-aws-runtime-resources.mjs";
const terraformPolicyPath = process.env.AWS_RUNTIME_IAM_TERRAFORM_SOURCE ?? "deploy/aws/terraform/main.tf";
const terraformVariablesPath = process.env.AWS_RUNTIME_IAM_VARIABLES_SOURCE ?? "deploy/aws/terraform/variables.tf";
const requiredGithubEnvironments = ["slot.blitz", "slot.eternum", "mainnet.blitz", "mainnet.eternum"];
const documentedWildcardExceptionSids = new Set(["EcsTaskDefinitions", "ElbRuntimeCreation"]);
const resourceScopedActionPrefixes = ["ecs:", "elasticloadbalancing:", "elasticfilesystem:"];
const requiredEcsExecTaskRoleActions = [
  "ssmmessages:CreateControlChannel",
  "ssmmessages:CreateDataChannel",
  "ssmmessages:OpenControlChannel",
  "ssmmessages:OpenDataChannel",
];
const commandActionMap = new Map([
  ["cloudwatch:delete-alarms", "cloudwatch:DeleteAlarms"],
  ["cloudwatch:describe-alarms", "cloudwatch:DescribeAlarms"],
  ["cloudwatch:put-metric-alarm", "cloudwatch:PutMetricAlarm"],
  ["ecr:describe-images", "ecr:DescribeImages"],
  ["ecs:create-service", "ecs:CreateService"],
  ["ecs:delete-service", "ecs:DeleteService"],
  ["ecs:describe-services", "ecs:DescribeServices"],
  ["ecs:describe-task-definition", "ecs:DescribeTaskDefinition"],
  ["ecs:describe-tasks", "ecs:DescribeTasks"],
  ["ecs:register-task-definition", "ecs:RegisterTaskDefinition"],
  ["ecs:run-task", "ecs:RunTask"],
  ["ecs:tag-resource", "ecs:TagResource"],
  ["ecs:update-service", "ecs:UpdateService"],
  ["ecs:wait", "ecs:DescribeServices"],
  ["efs:create-access-point", "elasticfilesystem:CreateAccessPoint"],
  ["efs:delete-access-point", "elasticfilesystem:DeleteAccessPoint"],
  ["efs:describe-access-points", "elasticfilesystem:DescribeAccessPoints"],
  ["elbv2:create-rule", "elasticloadbalancing:CreateRule"],
  ["elbv2:create-target-group", "elasticloadbalancing:CreateTargetGroup"],
  ["elbv2:delete-rule", "elasticloadbalancing:DeleteRule"],
  ["elbv2:delete-target-group", "elasticloadbalancing:DeleteTargetGroup"],
  ["elbv2:describe-rules", "elasticloadbalancing:DescribeRules"],
  ["elbv2:describe-tags", "elasticloadbalancing:DescribeTags"],
  ["elbv2:describe-target-groups", "elasticloadbalancing:DescribeTargetGroups"],
  ["logs:filter-log-events", "logs:FilterLogEvents"],
  ["resourcegroupstaggingapi:get-resources", "tag:GetResources"],
]);

function main() {
  const runtimeCommands = [
    ...extractAwsCommands(readSourceInput(runtimeSourcePath)),
    ...extractAwsCommands(readSourceInput(resourceAuditSourcePath)),
  ];
  const requiredActions = resolveRequiredPolicyActions(runtimeCommands);
  const terraformSource = fs.readFileSync(terraformPolicyPath, "utf8");
  const terraformVariablesSource = fs.readFileSync(terraformVariablesPath, "utf8");
  const grantedActions = extractGrantedPolicyActions(terraformSource);
  const failures = [
    ...requiredActions.filter((action) => !grantedActions.has(action)).map((action) => `missing IAM action ${action}`),
    ...validateRuntimeStoppedNotifications(terraformSource),
    ...validateDeployerGrantMapping(terraformSource),
    ...validatePassRoleScope(terraformSource),
    ...validateEcsExecTaskRole(terraformSource),
    ...validateRuntimeResourceScopes(terraformSource),
    ...validateOidcTrustScope(terraformSource),
    ...validateGithubEnvironmentDefaults(terraformVariablesSource),
  ];

  if (failures.length === 0) {
    return;
  }

  console.error("AWS runtime IAM and observability checks failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

function readSourceInput(sourcePath) {
  const stats = fs.statSync(sourcePath);
  if (stats.isFile()) {
    return fs.readFileSync(sourcePath, "utf8");
  }

  if (stats.isDirectory()) {
    return listSourceFiles(sourcePath)
      .map((filePath) => fs.readFileSync(filePath, "utf8"))
      .join("\n");
  }

  return "";
}

function listSourceFiles(sourceDir) {
  return fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(sourceDir, entry.name);
      if (entry.isDirectory()) {
        return listSourceFiles(entryPath);
      }

      return entry.isFile() && isRuntimeSourceFile(entry.name) ? [entryPath] : [];
    })
    .sort();
}

function isRuntimeSourceFile(fileName) {
  return /\.(cjs|cts|js|mjs|mts|ts)$/.test(fileName);
}

function extractAwsCommands(source) {
  return Array.from(
    source.matchAll(
      /"(?<service>cloudwatch|ecr|ecs|efs|elbv2|logs|resourcegroupstaggingapi)"\s*,\s*\n\s*"(?<command>[a-z-]+)"/g,
    ),
  ).map((match) => `${match.groups.service}:${match.groups.command}`);
}

function resolveRequiredPolicyActions(commands) {
  const unknownCommands = commands.filter((command) => !commandActionMap.has(command));
  if (unknownCommands.length > 0) {
    console.error("AWS runtime deployer uses commands without an IAM mapping:");
    for (const command of [...new Set(unknownCommands)].sort()) {
      console.error(`- ${command}`);
    }
    process.exit(1);
  }

  return [...new Set(commands.map((command) => commandActionMap.get(command)))].sort();
}

function extractGrantedPolicyActions(terraformSource) {
  return new Set(
    Array.from(
      terraformSource.matchAll(/"(cloudwatch|ecr|ecs|elasticfilesystem|elasticloadbalancing|iam|logs|tag):[^"]+"/g),
    ).map((match) => match[0].slice(1, -1)),
  );
}

function validateRuntimeStoppedNotifications(terraformSource) {
  const requiredSnippets = [
    'resource "aws_cloudwatch_event_rule" "ecs_task_stopped"',
    'source      = ["aws.ecs"]',
    'detail-type = ["ECS Task State Change"]',
    'lastStatus = ["STOPPED"]',
    'resource "aws_cloudwatch_event_target" "ecs_task_stopped_alerts"',
    'resource "aws_sns_topic_policy" "runtime_alerts_events"',
  ];

  return requiredSnippets
    .filter((snippet) => !terraformSource.includes(snippet))
    .map((snippet) => `Terraform missing ECS task-stopped notification snippet: ${snippet}`);
}

function validateDeployerGrantMapping(terraformSource) {
  const deployerPolicy = extractTerraformResource(terraformSource, "aws_iam_role_policy", "github_runtime_deployer");
  if (!deployerPolicy) {
    return ["Terraform missing github runtime deployer role policy"];
  }

  const mappingBlock = extractDeployerGrantMapping(deployerPolicy);
  const mappedSids = extractMappedGrantSids(mappingBlock);
  return extractPolicyStatements(deployerPolicy)
    .filter((statement) => !mappedSids.has(statement.sid))
    .map((statement) => `Deployer grant mapping missing Sid ${statement.sid}`);
}

function extractDeployerGrantMapping(source) {
  const marker = "# Deployer grant mapping:";
  const start = source.indexOf(marker);
  if (start === -1) {
    return "";
  }

  const policyStart = source.indexOf("policy = jsonencode", start);
  return source.slice(start, policyStart === -1 ? source.length : policyStart);
}

function extractMappedGrantSids(mappingBlock) {
  return new Set(Array.from(mappingBlock.matchAll(/# - (?<sid>[A-Za-z0-9]+):/g)).map((match) => match.groups.sid));
}

function validatePassRoleScope(terraformSource) {
  const passRoleStatement = extractStatementAround(terraformSource, '"iam:PassRole"');
  if (!passRoleStatement) {
    return ["Terraform missing iam:PassRole deployer grant"];
  }

  const failures = [];
  if (hasWildcardResource(passRoleStatement)) {
    failures.push('iam:PassRole must not allow Resource = "*"');
  }
  if (
    !passRoleStatement.includes('"iam:PassedToService"') ||
    !passRoleStatement.includes('"ecs-tasks.amazonaws.com"')
  ) {
    failures.push("iam:PassRole must require iam:PassedToService = ecs-tasks.amazonaws.com");
  }
  return failures;
}

function validateEcsExecTaskRole(terraformSource) {
  const taskRolePolicy = extractTerraformResource(terraformSource, "aws_iam_role_policy", "task");
  if (!taskRolePolicy) {
    return [
      "Terraform missing task role policy for ECS Exec",
      ...requiredEcsExecTaskRoleActions.map((action) => `task role missing ${action} for ECS Exec`),
    ];
  }

  return requiredEcsExecTaskRoleActions
    .filter((action) => !taskRolePolicy.includes(`"${action}"`))
    .map((action) => `task role missing ${action} for ECS Exec`);
}

function validateRuntimeResourceScopes(terraformSource) {
  return extractPolicyStatements(terraformSource)
    .filter((statement) => hasWildcardResource(statement.source))
    .filter((statement) => hasResourceScopedRuntimeAction(statement.source))
    .filter((statement) => !documentedWildcardExceptionSids.has(statement.sid))
    .map((statement) => `${statement.sid} must not allow Resource = "*"`);
}

function hasResourceScopedRuntimeAction(statementSource) {
  return resourceScopedActionPrefixes.some((prefix) => statementSource.includes(`"${prefix}`));
}

function validateOidcTrustScope(terraformSource) {
  if (terraformSource.includes("environment:*")) {
    return ["OIDC trust policy must not allow environment:*"];
  }
  if (!terraformSource.includes("var.github_environments")) {
    return ["OIDC trust policy must enumerate var.github_environments"];
  }
  return [];
}

function validateGithubEnvironmentDefaults(terraformVariablesSource) {
  const githubEnvironmentVariable = extractTerraformVariable(terraformVariablesSource, "github_environments");
  if (!githubEnvironmentVariable) {
    return ["github_environments variable must declare the allowed GitHub environments"];
  }
  if (githubEnvironmentVariable.includes('"*"')) {
    return ["github_environments must not default to wildcard entries"];
  }

  return requiredGithubEnvironments
    .filter((environment) => !githubEnvironmentVariable.includes(`"${environment}"`))
    .map((environment) => `github_environments must include ${environment}`);
}

function extractPolicyStatements(source) {
  return Array.from(source.matchAll(/Sid\s*=\s*"(?<sid>[^"]+)"/g)).map((match) => ({
    sid: match.groups.sid,
    source:
      extractStatementAround(source, `Sid    = "${match.groups.sid}"`) ??
      extractStatementAround(source, match[0]) ??
      "",
  }));
}

function extractStatementAround(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const statementStart = source.lastIndexOf("{", markerIndex);
  const statementEnd = source.indexOf("\n      }", markerIndex);
  if (statementStart === -1 || statementEnd === -1) {
    return source.slice(Math.max(0, markerIndex - 500), markerIndex + 500);
  }

  return source.slice(statementStart, statementEnd + "\n      }".length);
}

function hasWildcardResource(statementSource) {
  return /Resource\s*=\s*"\*"/.test(statementSource) || /Resource\s*=\s*\[\s*"\*"\s*\]/.test(statementSource);
}

function extractTerraformResource(source, resourceType, resourceName) {
  const marker = `resource "${resourceType}" "${resourceName}"`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const nextResourceIndex = source.indexOf('\nresource "', markerIndex + marker.length);
  return source.slice(markerIndex, nextResourceIndex === -1 ? source.length : nextResourceIndex);
}

function extractTerraformVariable(source, variableName) {
  const marker = `variable "${variableName}"`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const nextVariableIndex = source.indexOf('\nvariable "', markerIndex + marker.length);
  return source.slice(markerIndex, nextVariableIndex === -1 ? source.length : nextVariableIndex);
}

main();
