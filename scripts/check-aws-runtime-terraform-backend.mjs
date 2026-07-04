import fs from "node:fs";
import process from "node:process";

const versionsPath = process.env.AWS_RUNTIME_TERRAFORM_VERSIONS_SOURCE ?? "deploy/aws/terraform/versions.tf";
const mainPath = process.env.AWS_RUNTIME_TERRAFORM_MAIN_SOURCE ?? "deploy/aws/terraform/main.tf";
const readmePath = process.env.AWS_RUNTIME_TERRAFORM_README_SOURCE ?? "deploy/aws/README.md";

function main() {
  const versions = fs.readFileSync(versionsPath, "utf8");
  const main = fs.readFileSync(mainPath, "utf8");
  const readme = fs.readFileSync(readmePath, "utf8");
  const failures = [
    ...validateVersionsBackend(versions),
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
    "terraform init",
    '-backend-config="bucket=',
    '-backend-config="dynamodb_table=',
    "aws-runtime/foundation.tfstate",
  ];

  return requiredSnippets
    .filter((snippet) => !source.includes(snippet))
    .map((snippet) => `README missing remote-state snippet: ${snippet}`);
}

function validateNetworkHardeningDocs(source) {
  const requiredSnippets = ["enable_vpc_endpoints", "single NAT gateway"];

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
    ...validateRemovedDeadRuntimeSurfaces(source),
    ...validateSingleBackupMechanism(source),
  ];
}

function validateRuntimeTaskIngress(source) {
  const runtimeTasksSecurityGroup = extractTerraformBlock(source, "resource", "aws_security_group", "runtime_tasks");
  if (!runtimeTasksSecurityGroup) {
    return ['missing resource "aws_security_group" "runtime_tasks"'];
  }

  const ingressPorts = Array.from(runtimeTasksSecurityGroup.matchAll(/ingress\s*\{(?<body>[\s\S]*?)\n\s*\}/g))
    .map((match) => parseIngressPortRange(match.groups.body))
    .filter(Boolean)
    .sort((left, right) => left.from - right.from || left.to - right.to);
  const expectedPorts = [
    { from: 5050, to: 5050 },
    { from: 8080, to: 8080 },
  ];

  if (JSON.stringify(ingressPorts) === JSON.stringify(expectedPorts)) {
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

function parseIngressPortRange(source) {
  const from = Number(/from_port\s*=\s*(?<port>\d+)/.exec(source)?.groups?.port);
  const to = Number(/to_port\s*=\s*(?<port>\d+)/.exec(source)?.groups?.port);
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return undefined;
  }

  return { from, to };
}

function hasTerraformBlock(source, blockKind, type, name) {
  return extractTerraformBlock(source, blockKind, type, name) !== undefined;
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
