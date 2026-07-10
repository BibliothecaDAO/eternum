import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const versionsPath = process.env.AWS_RUNTIME_TERRAFORM_VERSIONS_SOURCE ?? "deploy/aws/terraform/versions.tf";
const mainPath = process.env.AWS_RUNTIME_TERRAFORM_MAIN_SOURCE ?? "deploy/aws/terraform/main.tf";
const readmePath = process.env.AWS_RUNTIME_TERRAFORM_README_SOURCE ?? "deploy/aws/README.md";
const rootsPath = process.env.AWS_RUNTIME_TERRAFORM_ROOTS_SOURCE ?? "deploy/aws/terraform/roots";
const stateBootstrapPath =
  process.env.AWS_RUNTIME_TERRAFORM_STATE_BOOTSTRAP_SOURCE ?? "deploy/aws/terraform/state-bootstrap";
const expectedRoots = new Map([
  ["slot-blitz", "aws-runtime/non-production/slot.blitz.tfstate"],
  ["slot-eternum", "aws-runtime/non-production/slot.eternum.tfstate"],
  ["slottest-blitz", "aws-runtime/non-production/slottest.blitz.tfstate"],
  ["slottest-eternum", "aws-runtime/non-production/slottest.eternum.tfstate"],
  ["mainnet-blitz", "aws-runtime/production/mainnet.blitz.tfstate"],
  ["mainnet-eternum", "aws-runtime/production/mainnet.eternum.tfstate"],
  ["dr-mainnet-blitz", "aws-runtime/dr/mainnet.blitz.tfstate"],
  ["dr-mainnet-eternum", "aws-runtime/dr/mainnet.eternum.tfstate"],
]);

function main() {
  const versions = fs.readFileSync(versionsPath, "utf8");
  const main = fs.readFileSync(mainPath, "utf8");
  const readme = fs.readFileSync(readmePath, "utf8");
  const failures = [
    ...validateStateLayout(versions),
    ...validateTerraformHardening(main),
    ...validateRemoteStateDocs(readme),
    ...validateNetworkHardeningDocs(readme),
  ];

  if (failures.length === 0) {
    return;
  }

  console.error("AWS runtime Terraform remote state is incomplete:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

function validateStateLayout(moduleVersions) {
  if (process.env.AWS_RUNTIME_TERRAFORM_VERSIONS_SOURCE) {
    return validateVersionsBackend(moduleVersions);
  }

  const failures = [];
  if (/backend\s+"s3"/.test(moduleVersions)) {
    failures.push("reusable Terraform module must not own a shared backend");
  }

  for (const [rootName, expectedKey] of expectedRoots) {
    const versionsFile = path.join(rootsPath, rootName, "versions.tf");
    const mainFile = path.join(rootsPath, rootName, "main.tf");
    if (!fs.existsSync(versionsFile) || !fs.existsSync(mainFile)) {
      failures.push(`missing isolated Terraform root ${rootName}`);
      continue;
    }

    const rootVersions = fs.readFileSync(versionsFile, "utf8");
    const rootMain = fs.readFileSync(mainFile, "utf8");
    const backend = extractBackendBlock(rootVersions);
    if (!backend) {
      failures.push(`${rootName} missing terraform backend \"s3\" block`);
      continue;
    }
    for (const [field, pattern] of [
      ["key", new RegExp(`key\\s*=\\s*"${escapeRegex(expectedKey)}"`)],
      ["region", /region\s*=\s*"us-east-1"/],
      ["dynamodb_table", /dynamodb_table\s*=\s*"[^"]+"/],
      ["encrypt", /encrypt\s*=\s*true/],
    ]) {
      if (!pattern.test(backend)) {
        failures.push(`${rootName} backend \"s3\" missing ${field}`);
      }
    }
    if (!rootMain.includes(`github_environment                  = local.environment_id`)) {
      failures.push(`${rootName} must bind OIDC to its exact environment`);
    }
  }

  return [...failures, ...validateStateBootstrap()];
}

function validateStateBootstrap() {
  const mainFile = path.join(stateBootstrapPath, "main.tf");
  if (!fs.existsSync(mainFile)) {
    return ["missing hardened Terraform state bootstrap"];
  }

  const source = fs.readFileSync(mainFile, "utf8");
  const requiredSnippets = [
    'resource "aws_kms_key" "state"',
    'resource "aws_s3_bucket_versioning" "state"',
    'resource "aws_s3_bucket_public_access_block" "state"',
    'resource "aws_s3_bucket_replication_configuration" "state"',
    'resource "aws_ecr_replication_configuration" "runtime"',
    'resource "aws_ecr_registry_policy" "runtime_replication"',
    'resource "aws_dynamodb_table" "locks"',
    "deletion_protection_enabled = true",
    '"aws:SecureTransport"',
  ];
  return requiredSnippets
    .filter((snippet) => !source.includes(snippet))
    .map((snippet) => `state bootstrap missing ${snippet}`);
}

function validateVersionsBackend(source) {
  const backendBlock = extractBackendBlock(source);
  if (!backendBlock) {
    return ['missing terraform backend "s3" block'];
  }

  const requiredFields = [
    ["key", /key\s*=\s*"aws-runtime\/foundation\.tfstate"/],
    ["region", /region\s*=\s*"us-east-1"/],
    ["dynamodb_table", /dynamodb_table\s*=\s*"[^"]+"/],
    ["encrypt", /encrypt\s*=\s*true/],
  ];

  return requiredFields
    .filter(([, pattern]) => !pattern.test(backendBlock))
    .map(([field]) => `backend "s3" missing ${field}`);
}

function validateRemoteStateDocs(source) {
  const requiredSnippets = [
    "## Remote State",
    " init \\",
    '-backend-config="bucket=',
    '-backend-config="dynamodb_table=',
    "aws-runtime/non-production/slot.blitz.tfstate",
    "aws-runtime/production/mainnet.blitz.tfstate",
    "aws-runtime/dr/mainnet.blitz.tfstate",
  ];

  return requiredSnippets
    .filter((snippet) => !source.includes(snippet))
    .map((snippet) => `README missing remote-state snippet: ${snippet}`);
}

function validateNetworkHardeningDocs(source) {
  const requiredSnippets = ["enable_vpc_endpoints", "one non-production NAT gateway", "per-AZ production NAT gateways"];

  return requiredSnippets
    .filter((snippet) => !source.includes(snippet))
    .map((snippet) => `README missing network hardening snippet: ${snippet}`);
}

function validateTerraformHardening(source) {
  return [
    ...validateRuntimeTaskIngress(source),
    ...validateLoadBalancerHardening(source),
    ...validateRuntimeImageLifecycle(source),
    ...validateVpcEndpoints(source),
    ...validateFoundationAlerts(source),
    ...validateAlertPolicyOwnership(source),
    ...validateRemovedDeadRuntimeSurfaces(source),
    ...validateSingleBackupMechanism(source),
    ...validateIsolationControls(source),
  ];
}

function validateAlertPolicyOwnership(source) {
  const runtimeAlertPolicies = extractTerraformResources(source, "aws_sns_topic_policy").filter(({ body }) =>
    body.includes("aws_sns_topic.runtime_alerts.arn"),
  );
  const failures = [];
  if (runtimeAlertPolicies.length !== 1) {
    failures.push("Terraform must manage the runtime alert topic with exactly one aws_sns_topic_policy resource");
  }
  if (!source.includes('identifiers = ["budgets.amazonaws.com", "cloudwatch.amazonaws.com", "events.amazonaws.com"]')) {
    failures.push("Terraform runtime KMS policy must allow every encrypted alert publisher");
  }
  return failures;
}

function validateIsolationControls(source) {
  const requiredResources = [
    ["aws_dynamodb_table", "runtime_control"],
    ["aws_wafv2_web_acl", "runtime"],
    ["aws_wafv2_web_acl_association", "runtime"],
    ["aws_backup_vault_lock_configuration", "runtime"],
    ["aws_backup_plan", "runtime"],
    ["aws_secretsmanager_secret", "upstream_rpc"],
    ["aws_ssm_parameter", "foundation_manifest"],
  ];
  const failures = requiredResources
    .filter(([type, name]) => !hasTerraformBlock(source, "resource", type, name))
    .map(([type, name]) => `Terraform missing ${type}.${name}`);

  if (!source.includes("local.is_production ? length(var.public_subnet_cidrs) : 1")) {
    failures.push("Terraform must use per-AZ production NAT gateways and one non-production NAT gateway");
  }
  if (!source.includes('!startswith(var.environment_id, "mainnet.") || var.waf_enforcement_mode == "block"')) {
    failures.push("Terraform must require enforced WAF rules for mainnet foundations");
  }
  for (const protectedPath of ["/rpc/", "/sql", "/graphql"]) {
    if (!source.includes(`path = "${protectedPath}"`)) {
      failures.push(`Terraform WAF must rate-limit ${protectedPath}`);
    }
  }
  const foundationManifest = extractTerraformBlock(source, "resource", "aws_ssm_parameter", "foundation_manifest");
  if (!foundationManifest?.includes('type        = "SecureString"') || !foundationManifest.includes("key_id")) {
    failures.push("Terraform must encrypt the non-secret foundation manifest with the environment KMS key");
  }
  return failures;
}

function validateRuntimeTaskIngress(source) {
  const runtimeTasksSecurityGroup = extractTerraformBlock(source, "resource", "aws_security_group", "runtime_tasks");
  if (!runtimeTasksSecurityGroup) {
    return ['missing resource "aws_security_group" "runtime_tasks"'];
  }

  const taskIngressRules = extractTerraformResources(source, "aws_vpc_security_group_ingress_rule").filter(({ body }) =>
    /^\s*security_group_id\s*=\s*aws_security_group\.runtime_tasks\.id/m.test(body),
  );
  const runtimeAlbRule = taskIngressRules.find(({ name }) => name === "runtime_alb")?.body;
  const hasExpectedRule =
    taskIngressRules.length === 1 &&
    runtimeAlbRule?.includes('for_each = toset(["5050", "8080"])') &&
    /referenced_security_group_id\s*=\s*aws_security_group\.alb\.id/.test(runtimeAlbRule) &&
    /from_port\s*=\s*tonumber\(each\.key\)/.test(runtimeAlbRule) &&
    /to_port\s*=\s*tonumber\(each\.key\)/.test(runtimeAlbRule) &&
    !runtimeAlbRule.includes("cidr_ipv4");

  if (!/\bingress\s*\{/.test(runtimeTasksSecurityGroup) && hasExpectedRule) {
    return [];
  }

  return ["runtime task security group must expose exactly ports 5050 and 8080"];
}

function validateLoadBalancerHardening(source) {
  const runtimeLoadBalancer = extractTerraformBlock(source, "resource", "aws_lb", "runtime");
  const httpsListener = extractTerraformBlock(source, "resource", "aws_lb_listener", "https");
  const failures = [];

  if (!runtimeLoadBalancer?.includes("access_logs")) {
    failures.push("Terraform ALB must enable access logs");
  }
  if (!runtimeLoadBalancer?.match(/idle_timeout\s*=\s*3600/)) {
    failures.push("Terraform ALB idle_timeout must be 3600");
  }
  if (!runtimeLoadBalancer?.match(/enable_deletion_protection\s*=\s*true/)) {
    failures.push("Terraform ALB deletion protection must be enabled");
  }
  if (!httpsListener?.includes('ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"')) {
    failures.push("Terraform HTTPS listener must use ELBSecurityPolicy-TLS13-1-2-2021-06");
  }

  return failures;
}

function validateRuntimeImageLifecycle(source) {
  if (hasTerraformBlock(source, "resource", "aws_ecr_lifecycle_policy", "runtime")) {
    return [];
  }

  return ["Terraform missing aws_ecr_lifecycle_policy.runtime"];
}

function validateVpcEndpoints(source) {
  const failures = [];
  const s3Endpoint = extractTerraformBlock(source, "resource", "aws_vpc_endpoint", "s3");
  const interfaceEndpoint = extractTerraformBlock(source, "resource", "aws_vpc_endpoint", "interface");

  if (!s3Endpoint) {
    failures.push("Terraform missing aws_vpc_endpoint.s3");
  }

  for (const endpoint of ["ecr.api", "ecr.dkr", "logs"]) {
    if (!interfaceEndpoint?.includes(`"${endpoint}"`)) {
      failures.push(`Terraform missing interface VPC endpoint ${endpoint}`);
    }
  }

  return failures;
}

function validateFoundationAlerts(source) {
  const requiredResources = [
    ["aws_sns_topic", "runtime_alerts"],
    ["aws_cloudwatch_metric_alarm", "alb_elb_5xx"],
    ["aws_cloudwatch_metric_alarm", "routing_shard_capacity"],
    ["aws_cloudwatch_metric_alarm", "nat_error_port_allocation"],
    ["aws_cloudwatch_metric_alarm", "efs_percent_io_limit"],
  ];

  return requiredResources
    .filter(([type, name]) => !hasTerraformBlock(source, "resource", type, name))
    .map(([type, name]) => `Terraform missing ${type}.${name}`);
}

function validateRemovedDeadRuntimeSurfaces(source) {
  const forbiddenResources = [
    ["aws_secretsmanager_secret", "runtime"],
    ["aws_ssm_parameter", "runtime_domain"],
  ];

  return forbiddenResources
    .filter(([type, name]) => hasTerraformBlock(source, "resource", type, name))
    .map(([type, name]) => `Terraform must not define ${type}.${name}`);
}

function validateSingleBackupMechanism(source) {
  if (!hasTerraformBlock(source, "resource", "aws_efs_backup_policy", "runtime")) {
    return [];
  }

  return ["Terraform must not define aws_efs_backup_policy.runtime"];
}

function extractBackendBlock(source) {
  return /backend\s+"s3"\s*\{(?<body>[\s\S]*?)\n\s*\}/.exec(source)?.groups?.body;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasTerraformBlock(source, blockKind, type, name) {
  return extractTerraformBlock(source, blockKind, type, name) !== undefined;
}

function extractTerraformResources(source, type) {
  return Array.from(source.matchAll(new RegExp(`resource "${escapeRegex(type)}" "(?<name>[^"]+)"`, "g"))).map(
    (match) => {
      const blockStart = source.indexOf("{", match.index);
      return {
        name: match.groups.name,
        body: source.slice(blockStart + 1, findMatchingBrace(source, blockStart)),
      };
    },
  );
}

function extractTerraformBlock(source, blockKind, type, name) {
  const marker = `${blockKind} "${type}" "${name}"`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    return undefined;
  }

  const blockStart = source.indexOf("{", markerIndex);
  if (blockStart === -1) {
    return undefined;
  }

  return source.slice(blockStart + 1, findMatchingBrace(source, blockStart));
}

function findMatchingBrace(source, blockStart) {
  let depth = 0;
  for (let index = blockStart; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    }
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return source.length;
}

main();
