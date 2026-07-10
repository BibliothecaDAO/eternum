import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, test } from "bun:test";

describe("AWS runtime e2e harness", () => {
  test("exposes the PRD-required make target", () => {
    const source = fs.readFileSync("Makefile", "utf8");

    expect(source).toContain(".PHONY: aws-runtime-e2e");
    expect(source).toContain("aws-runtime-e2e:");
    expect(source).toContain("scripts/aws-runtime-e2e.mjs");
  });

  test("reports missing required inputs as structured JSON", () => {
    const result = spawnSync("node", ["scripts/aws-runtime-e2e.mjs", "--dry-run"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        AWS_RUNTIME_E2E_ENVIRONMENT: "",
        AWS_RUNTIME_E2E_RUNTIME_NAME: "",
        AWS_RUNTIME_E2E_RUNTIME_KIND: "",
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toBe("");

    const payload = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(payload).toMatchObject({
      operation: "aws-runtime-e2e",
      status: "failed",
      failureClassification: "runtime-validation",
    });
    expect(payload.errorMessage).toContain("AWS_RUNTIME_E2E_ENVIRONMENT");
    expect(payload.errorMessage).toContain("AWS_RUNTIME_E2E_RUNTIME_NAME");
    expect(payload.errorMessage).toContain("AWS_RUNTIME_E2E_RUNTIME_KIND");
  });

  test("resource audit reports missing inputs as structured JSON", () => {
    const result = spawnSync("node", ["scripts/check-aws-runtime-resources.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        AWS_RUNTIME_AUDIT_ENVIRONMENT: "",
        AWS_RUNTIME_AUDIT_RUNTIME_NAME: "",
        AWS_RUNTIME_AUDIT_RUNTIME_KIND: "",
        AWS_RUNTIME_AUDIT_RUNTIME_INSTANCE_ID: "",
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toBe("");

    const payload = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(payload).toMatchObject({
      operation: "aws-runtime-resource-audit",
      status: "failed",
      failureClassification: "runtime-validation",
    });
    expect(payload.errorMessage).toContain("AWS_RUNTIME_AUDIT_ENVIRONMENT");
    expect(payload.errorMessage).toContain("AWS_RUNTIME_AUDIT_RUNTIME_NAME");
    expect(payload.errorMessage).toContain("AWS_RUNTIME_AUDIT_RUNTIME_KIND");
    expect(payload.errorMessage).toContain("AWS_RUNTIME_AUDIT_RUNTIME_INSTANCE_ID");
  });

  test("resource audit checks concrete AWS resource surfaces", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "aws-runtime-audit-"));
    const binDir = path.join(workspace, "bin");
    const callsPath = path.join(workspace, "calls.log");
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(
      path.join(binDir, "aws"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "%s\\n" "$*" >> "${AWS_AUDIT_CALLS}"',
        'if [[ "$*" == *"elbv2 describe-target-groups"* ]]; then',
        "  cat <<'JSON'",
        JSON.stringify({
          TargetGroups: [
            {
              TargetGroupArn: "arn:aws:elasticloadbalancing:us-east-1:111111111111:targetgroup/orphan/abc",
            },
          ],
        }),
        "JSON",
        "  exit 0",
        "fi",
        "cat <<'JSON'",
        JSON.stringify({}),
        "JSON",
      ].join("\n"),
    );
    fs.chmodSync(path.join(binDir, "aws"), 0o755);

    const result = spawnSync(
      "node",
      [
        "scripts/check-aws-runtime-resources.mjs",
        "--environment",
        "slot.blitz",
        "--runtime-kind",
        "katana",
        "--runtime-name",
        "e2e-smoke",
        "--runtime-instance-id",
        "018f6e54-5f4a-7ae2-a0ff-123456789abc",
        "--region",
        "us-east-1",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          AWS_AUDIT_CALLS: callsPath,
          AWS_RUNTIME_AUDIT_ATTEMPTS: "1",
          PATH: `${binDir}:${process.env.PATH}`,
        },
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toBe("");

    const payload = JSON.parse(result.stdout) as {
      failureClassification: string;
      resourceCount: number;
      resources: Array<{ type: string; id: string }>;
    };
    expect(payload.failureClassification).toBe("runtime-orphans-detected");
    expect(payload.resourceCount).toBe(1);
    expect(payload.resources[0]).toEqual({
      type: "target-group",
      id: "arn:aws:elasticloadbalancing:us-east-1:111111111111:targetgroup/orphan/abc",
    });
    const calls = fs.readFileSync(callsPath, "utf8");
    expect(calls).toContain("ecs describe-services");
    expect(calls).toContain("ecs list-task-definitions");
    expect(calls).toContain("elbv2 describe-target-groups --names katana-e2e-smok-ba8d41929bfc7092");
    expect(calls).toContain("cloudwatch describe-alarms");
  });

  test("IAM guard rejects wildcard PassRole and wildcard OIDC environments", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "aws-runtime-iam-"));
    const runtimeSourcePath = path.join(workspace, "aws-runtime.ts");
    const resourceAuditSourcePath = path.join(workspace, "check-aws-runtime-resources.mjs");
    const terraformPath = path.join(workspace, "main.tf");
    const variablesPath = path.join(workspace, "variables.tf");

    fs.writeFileSync(runtimeSourcePath, "");
    fs.writeFileSync(resourceAuditSourcePath, "");
    fs.writeFileSync(
      terraformPath,
      `
data "aws_iam_policy_document" "github_oidc_assume_role" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:dojoengine/eternum:environment:*"]
    }
  }
}

resource "aws_iam_role_policy" "github_runtime_deployer" {
  # Deployer grant mapping:
  # - PassRuntimeRoles: pass only the runtime task roles to ECS tasks.
  policy = jsonencode({
    Statement = [
      {
        Sid      = "PassRuntimeRoles"
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = "*"
      },
      {
        Sid      = "EcsRuntimeLifecycle"
        Effect   = "Allow"
        Action   = ["ecs:CreateService", "ecs:DeleteService"]
        Resource = "*"
      },
      {
        Sid      = "ElbRuntimeLifecycle"
        Effect   = "Allow"
        Action   = ["elasticloadbalancing:DeleteRule", "elasticloadbalancing:DeleteTargetGroup"]
        Resource = "*"
      },
      {
        Sid      = "EfsAccessPoints"
        Effect   = "Allow"
        Action   = ["elasticfilesystem:CreateAccessPoint", "elasticfilesystem:DeleteAccessPoint"]
        Resource = "*"
      },
      {
        Sid      = "UnmappedRuntimeGrant"
        Effect   = "Allow"
        Action   = ["logs:FilterLogEvents"]
        Resource = "*"
      }
    ]
  })
}

resource "aws_cloudwatch_event_rule" "ecs_task_stopped" {
  event_pattern = jsonencode({
    source      = ["aws.ecs"]
    detail-type = ["ECS Task State Change"]
    detail = {
      lastStatus = ["STOPPED"]
    }
  })
}

resource "aws_cloudwatch_event_target" "ecs_task_stopped_alerts" {}
resource "aws_sns_topic_policy" "runtime_alerts_events" {}
`,
    );
    fs.writeFileSync(
      variablesPath,
      `
variable "github_environments" {
  type    = list(string)
  default = ["*"]
}
`,
    );

    const result = spawnSync("node", ["scripts/check-aws-runtime-iam-policy.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        AWS_RUNTIME_IAM_RUNTIME_SOURCE: runtimeSourcePath,
        AWS_RUNTIME_IAM_RESOURCE_AUDIT_SOURCE: resourceAuditSourcePath,
        AWS_RUNTIME_IAM_TERRAFORM_SOURCE: terraformPath,
        AWS_RUNTIME_IAM_VARIABLES_SOURCE: variablesPath,
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('iam:PassRole must not allow Resource = "*"');
    expect(result.stderr).toContain('EcsRuntimeLifecycle must not allow Resource = "*"');
    expect(result.stderr).toContain('ElbRuntimeLifecycle must not allow Resource = "*"');
    expect(result.stderr).toContain('EfsAccessPoints must not allow Resource = "*"');
    expect(result.stderr).toContain("OIDC trust policy must not allow environment:*");
    expect(result.stderr).toContain("github_environments must not default to wildcard entries");
    expect(result.stderr).toContain("task role missing ssmmessages:CreateControlChannel for ECS Exec");
    expect(result.stderr).toContain("task role missing ssmmessages:CreateDataChannel for ECS Exec");
    expect(result.stderr).toContain("task role missing ssmmessages:OpenControlChannel for ECS Exec");
    expect(result.stderr).toContain("task role missing ssmmessages:OpenDataChannel for ECS Exec");
    expect(result.stderr).toContain("Deployer grant mapping missing Sid EcsRuntimeLifecycle");
    expect(result.stderr).toContain("Deployer grant mapping missing Sid UnmappedRuntimeGrant");
  });

  test("IAM guard scans split AWS runtime modules for unmapped commands", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "aws-runtime-iam-modules-"));
    const runtimeSourceDir = path.join(workspace, "runtime");
    const nestedModuleDir = path.join(runtimeSourceDir, "aws");
    const resourceAuditSourcePath = path.join(workspace, "check-aws-runtime-resources.mjs");
    const terraformPath = path.join(workspace, "main.tf");
    const variablesPath = path.join(workspace, "variables.tf");
    fs.mkdirSync(nestedModuleDir, { recursive: true });
    fs.writeFileSync(path.join(runtimeSourceDir, "aws-runtime.ts"), "");
    fs.writeFileSync(
      path.join(nestedModuleDir, "resources.ts"),
      `
commandRunner([
  "ecs",
  "list-account-settings",
]);
`,
    );
    fs.writeFileSync(resourceAuditSourcePath, "");
    fs.writeFileSync(terraformPath, "");
    fs.writeFileSync(variablesPath, "");

    const result = spawnSync("node", ["scripts/check-aws-runtime-iam-policy.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        AWS_RUNTIME_IAM_RUNTIME_SOURCE: runtimeSourceDir,
        AWS_RUNTIME_IAM_RESOURCE_AUDIT_SOURCE: resourceAuditSourcePath,
        AWS_RUNTIME_IAM_TERRAFORM_SOURCE: terraformPath,
        AWS_RUNTIME_IAM_VARIABLES_SOURCE: variablesPath,
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("AWS runtime deployer uses commands without an IAM mapping");
    expect(result.stderr).toContain("ecs:list-account-settings");
  });

  test("Terraform guard rejects broad task ingress and dead runtime surfaces", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "aws-runtime-terraform-"));
    const mainPath = path.join(workspace, "main.tf");
    const versionsPath = path.join(workspace, "versions.tf");
    const readmePath = path.join(workspace, "README.md");

    fs.writeFileSync(
      mainPath,
      `
resource "aws_security_group" "runtime_tasks" {
  ingress {
    from_port       = 5050
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
}

resource "aws_secretsmanager_secret" "runtime" {}
resource "aws_ssm_parameter" "runtime_domain" {}
resource "aws_efs_backup_policy" "runtime" {}
`,
    );
    fs.writeFileSync(
      versionsPath,
      `
terraform {
  backend "s3" {
    key            = "aws-runtime/foundation.tfstate"
    region         = "us-east-1"
    dynamodb_table = "aws-runtime-foundation-locks"
    encrypt        = true
  }
}
`,
    );
    fs.writeFileSync(
      readmePath,
      `
## Remote State
terraform init -backend-config="bucket=<state-bucket>" -backend-config="dynamodb_table=aws-runtime-foundation-locks"
aws-runtime/foundation.tfstate
`,
    );

    const result = spawnSync("node", ["scripts/check-aws-runtime-terraform-backend.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        AWS_RUNTIME_TERRAFORM_MAIN_SOURCE: mainPath,
        AWS_RUNTIME_TERRAFORM_VERSIONS_SOURCE: versionsPath,
        AWS_RUNTIME_TERRAFORM_README_SOURCE: readmePath,
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("runtime task security group must expose exactly ports 5050 and 8080");
    expect(result.stderr).toContain("Terraform ALB must enable access logs");
    expect(result.stderr).toContain("Terraform ALB idle_timeout must be 3600");
    expect(result.stderr).toContain("Terraform HTTPS listener must use ELBSecurityPolicy-TLS13-1-2-2021-06");
    expect(result.stderr).toContain("Terraform missing aws_ecr_lifecycle_policy.runtime");
    expect(result.stderr).toContain("Terraform missing aws_vpc_endpoint.s3");
    expect(result.stderr).toContain("Terraform missing interface VPC endpoint ecr.api");
    expect(result.stderr).toContain("Terraform missing interface VPC endpoint ecr.dkr");
    expect(result.stderr).toContain("Terraform missing interface VPC endpoint logs");
    expect(result.stderr).toContain("Terraform missing aws_sns_topic.runtime_alerts");
    expect(result.stderr).toContain("Terraform missing aws_cloudwatch_metric_alarm.alb_elb_5xx");
    expect(result.stderr).toContain("Terraform missing aws_cloudwatch_metric_alarm.nat_error_port_allocation");
    expect(result.stderr).toContain("Terraform missing aws_cloudwatch_metric_alarm.efs_percent_io_limit");
    expect(result.stderr).toContain("Terraform must not define aws_secretsmanager_secret.runtime");
    expect(result.stderr).toContain("Terraform must not define aws_ssm_parameter.runtime_domain");
    expect(result.stderr).toContain("Terraform must not define aws_efs_backup_policy.runtime");
    expect(result.stderr).toContain("README missing network hardening snippet: enable_vpc_endpoints");
    expect(result.stderr).toContain("README missing network hardening snippet: one non-production NAT gateway");
  });

  test("README parity guard rejects missing access control docs", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "aws-runtime-readme-"));
    const outputsPath = path.join(workspace, "outputs.tf");
    const variablesPath = path.join(workspace, "variables.tf");
    const readmePath = path.join(workspace, "README.md");

    fs.writeFileSync(
      outputsPath,
      `
output "aws_region" {}
`,
    );
    fs.writeFileSync(
      variablesPath,
      `
variable "github_environments" {
  default = ["slot.blitz", "slot.eternum", "mainnet.blitz", "mainnet.eternum"]
}
`,
    );
    fs.writeFileSync(
      readmePath,
      `
## Foundation
The important outputs map directly to GitHub environment variables:

- \`AWS_REGION\`

Operator-set GitHub environment variables:

- \`RUNTIME_PROVIDER\`

## GitHub Environment Checklist

- \`slot.blitz\`
- \`slot.eternum\`
- \`mainnet.blitz\`
- \`mainnet.eternum\`

Mainnet environments must set required reviewers and deployment branch policy = \`next\`.
`,
    );

    const result = spawnSync("node", ["scripts/check-aws-runtime-readme-parity.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        AWS_RUNTIME_README_OUTPUTS_SOURCE: outputsPath,
        AWS_RUNTIME_README_VARIABLES_SOURCE: variablesPath,
        AWS_RUNTIME_README_SOURCE: readmePath,
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("README missing access control snippet: ## Access Control");
    expect(result.stderr).toContain("README missing access control snippet: Deploy roles");
    expect(result.stderr).toContain("README missing access control snippet: cannot assume");
  });

  test("README parity guard rejects missing storage validation table", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "aws-runtime-readme-storage-"));
    const outputsPath = path.join(workspace, "outputs.tf");
    const variablesPath = path.join(workspace, "variables.tf");
    const readmePath = path.join(workspace, "README.md");

    fs.writeFileSync(
      outputsPath,
      `
output "aws_region" {}
`,
    );
    fs.writeFileSync(
      variablesPath,
      `
variable "github_environments" {
  default = ["slot.blitz", "slot.eternum", "mainnet.blitz", "mainnet.eternum"]
}
`,
    );
    fs.writeFileSync(
      readmePath,
      `
## Foundation
The important outputs map directly to GitHub environment variables:

- \`AWS_REGION\`

Operator-set GitHub environment variables:

- \`RUNTIME_PROVIDER\`

## GitHub Environment Checklist

- \`slot.blitz\`
- \`slot.eternum\`
- \`mainnet.blitz\`
- \`mainnet.eternum\`

Mainnet environments must set required reviewers and deployment branch policy = \`next\`.

## Access Control

The Terraform OIDC trust enumerates the allowed GitHub environments: \`slot.blitz\`, \`slot.eternum\`,
\`mainnet.blitz\`, and \`mainnet.eternum\`. Mainnet GitHub environments must set required reviewers and restrict
deployment branches to \`next\`. The deployer uses a single role shared by the allowed environments; new GitHub
environments cannot assume it until they are added to \`github_environments\`.

## Storage Architecture

Runtime databases live on task-local Fargate ephemeral storage. EFS is mounted at \`/snapshots\`.
`,
    );

    const result = spawnSync("node", ["scripts/check-aws-runtime-readme-parity.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        AWS_RUNTIME_README_OUTPUTS_SOURCE: outputsPath,
        AWS_RUNTIME_README_VARIABLES_SOURCE: variablesPath,
        AWS_RUNTIME_README_SOURCE: readmePath,
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("README missing storage validation snippet: ## Storage Validation Results");
    expect(result.stderr).toContain("README missing storage validation snippet: crash/restore");
    expect(result.stderr).toContain("README missing storage validation snippet: 24h torii soak");
    expect(result.stderr).toContain("README missing storage validation snippet: RPO/RTO sign-off");
  });

  test("workflow guard rejects missing runtime-scoped concurrency", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "aws-runtime-workflows-"));
    const runtimeDeployerPath = path.join(workspace, "aws-runtime-deployer.yml");
    const factoryToriiPath = path.join(workspace, "factory-torii-deployer.yml");
    const indexerMaintenancePath = path.join(workspace, "factory-indexer-maintenance.yml");

    fs.writeFileSync(
      runtimeDeployerPath,
      `
name: AWS Runtime Deployer
concurrency:
  group: aws-runtime-global
  cancel-in-progress: true
`,
    );
    fs.writeFileSync(
      factoryToriiPath,
      `
name: Factory Torii Deployer
concurrency:
  group: aws-runtime-\${{ inputs.environment_id }}
  cancel-in-progress: false
`,
    );
    fs.writeFileSync(
      indexerMaintenancePath,
      `
name: Factory Indexer Maintenance
jobs: {}
`,
    );

    const result = spawnSync("node", ["scripts/check-aws-runtime-workflows.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        AWS_RUNTIME_WORKFLOW_RUNTIME_DEPLOYER_SOURCE: runtimeDeployerPath,
        AWS_RUNTIME_WORKFLOW_FACTORY_TORII_SOURCE: factoryToriiPath,
        AWS_RUNTIME_WORKFLOW_INDEXER_MAINTENANCE_SOURCE: indexerMaintenancePath,
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("aws-runtime-deployer.yml concurrency must keep cancellation disabled");
    expect(result.stderr).toContain("aws-runtime-deployer.yml concurrency group must include environment identity");
    expect(result.stderr).toContain("aws-runtime-deployer.yml concurrency group must include runtime identity");
    expect(result.stderr).toContain("factory-torii-deployer.yml concurrency group must include runtime identity");
    expect(result.stderr).toContain("factory-indexer-maintenance.yml must define workflow concurrency");
  });

  test("workflow guard rejects unsafe runtime image publishing workflow", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "aws-runtime-image-workflow-"));
    const imageWorkflowPath = path.join(workspace, "aws-runtime-image.yml");

    fs.writeFileSync(
      imageWorkflowPath,
      `
name: AWS Runtime Image
on:
  workflow_dispatch:
  push:
    paths:
      - "deploy/aws/terraform/**"
jobs:
  build:
    steps:
      - name: Build image
        uses: docker/build-push-action@v6
        with:
          context: deploy/aws/runtime-image
          push: false
          platforms: linux/arm64
          tags: latest
`,
    );

    const result = spawnSync("node", ["scripts/check-aws-runtime-workflows.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        AWS_RUNTIME_WORKFLOW_RUNTIME_IMAGE_SOURCE: imageWorkflowPath,
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("aws-runtime-image.yml push trigger must include deploy/aws/runtime-image/**");
    expect(result.stderr).toContain("aws-runtime-image.yml must publish linux/amd64 images");
    expect(result.stderr).toContain("aws-runtime-image.yml must push the image");
    expect(result.stderr).toContain("aws-runtime-image.yml must expose the pushed image digest");
    expect(result.stderr).toContain("aws-runtime-image.yml must summarize the pushed image digest");
    expect(result.stderr).toContain("aws-runtime-image.yml tag must include DOJO_VERSION and the git sha");
    expect(result.stderr).toContain("aws-runtime-image.yml must request OIDC id-token permission");
    expect(result.stderr).toContain("aws-runtime-image.yml must configure AWS credentials");
    expect(result.stderr).toContain("aws-runtime-image.yml must login to ECR before pushing");
    expect(result.stderr).toContain(
      "aws-runtime-image.yml must allow only exact non-production candidate environments",
    );
    expect(result.stderr).toContain("aws-runtime-image.yml must validate dojo_version before writing outputs");
    expect(result.stderr).toContain(
      "aws-runtime-image.yml must validate the candidate request before assuming AWS credentials",
    );
  });

  test("maintenance workflow payload transport does not execute shell syntax", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "aws-runtime-injection-"));
    const outputPath = path.join(workspace, "operations.json");
    const markerPath = path.join(workspace, "payload-executed");
    const payload = JSON.stringify([
      {
        action: "inspect",
        environmentId: "slot.blitz",
        gameName: `quote-'\"\n$(touch ${markerPath})\n\`touch ${markerPath}\`\n; touch ${markerPath}`,
      },
    ]);

    const result = spawnSync(
      "bash",
      ["-c", 'set -euo pipefail\nprintf \'%s\' "${OPERATIONS_JSON}" > "${OUTPUT_FILE}"'],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, OPERATIONS_JSON: payload, OUTPUT_FILE: outputPath },
      },
    );

    expect(result.status).toBe(0);
    expect(fs.readFileSync(outputPath, "utf8")).toBe(payload);
    expect(fs.existsSync(markerPath)).toBe(false);
    expect(fs.readFileSync(".github/workflows/factory-indexer-maintenance.yml", "utf8")).toContain(
      'printf \'%s\' "${OPERATIONS_JSON}" > "${operations_file}"',
    );
  });

  test("workflow guard rejects missing nightly runtime e2e validation workflow", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "aws-runtime-e2e-workflow-"));
    const e2eWorkflowPath = path.join(workspace, "aws-runtime-e2e.yml");

    fs.writeFileSync(
      e2eWorkflowPath,
      `
name: AWS Runtime E2E
on:
  push:
    branches: [next]
jobs:
  e2e:
    steps:
      - run: echo "not enough"
`,
    );

    const result = spawnSync("node", ["scripts/check-aws-runtime-workflows.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        AWS_RUNTIME_WORKFLOW_E2E_SOURCE: e2eWorkflowPath,
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("aws-runtime-e2e.yml must run on a nightly schedule");
    expect(result.stderr).toContain("aws-runtime-e2e.yml must support manual workflow dispatch");
    expect(result.stderr).toContain("aws-runtime-e2e.yml must run make aws-runtime-e2e");
    expect(result.stderr).toContain("aws-runtime-e2e.yml must request OIDC id-token permission");
    expect(result.stderr).toContain("aws-runtime-e2e.yml must configure AWS credentials");
    expect(result.stderr).toContain("aws-runtime-e2e.yml must upload the e2e JSON artifact");
  });

  test("provider guard rejects retired switches and hardcoded AWS workflow defaults", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "aws-runtime-provider-"));
    const legacyConfigPath = path.join(workspace, "legacy-provider.ts");
    const workflowPath = path.join(workspace, "factory-torii-deployer.yml");

    fs.writeFileSync(
      legacyConfigPath,
      `
const indexerProvider = process.env.INDEXER_RUNTIME_PROVIDER;
const factoryProvider = process.env.FACTORY_RUNTIME_PROVIDER;
`,
    );
    fs.writeFileSync(
      workflowPath,
      `
env:
  RUNTIME_PROVIDER: aws
`,
    );

    const result = spawnSync("node", ["scripts/check-aws-runtime-provider-config.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        AWS_RUNTIME_PROVIDER_CHECK_SOURCE_PATHS: legacyConfigPath,
        AWS_RUNTIME_PROVIDER_CHECK_WORKFLOW_PATHS: workflowPath,
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("retired provider switch INDEXER_RUNTIME_PROVIDER");
    expect(result.stderr).toContain("retired provider switch FACTORY_RUNTIME_PROVIDER");
    expect(result.stderr).toContain("workflow must not hardcode RUNTIME_PROVIDER: aws");
  });

  test("URL guard rejects retired wss routes and missing protocol docs", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "aws-runtime-urls-"));
    const endpointSourcePath = path.join(workspace, "runtime-endpoints.ts");
    const readmePath = path.join(workspace, "README.md");

    fs.writeFileSync(
      endpointSourcePath,
      `
export type RuntimeEndpointKind = "base" | "health" | "rpc" | "sql" | "wss";
`,
    );
    fs.writeFileSync(
      readmePath,
      `
## Runtime Ownership
The public URL shape includes /x/{env}/{runtime}/torii/wss.
`,
    );

    const result = spawnSync("node", ["scripts/check-aws-runtime-url-builders.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        AWS_RUNTIME_URL_CHECK_SOURCE_PATHS: endpointSourcePath,
        AWS_RUNTIME_URL_CHECK_README_PATH: readmePath,
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("retired wss endpoint");
    expect(result.stderr).toContain("README missing protocol support snippet: ## Protocol Support");
    expect(result.stderr).toContain("README missing protocol support snippet: native gRPC");
  });

  test("make target emits JSON-only stdout from the harness", () => {
    const result = spawnSync("make", ["aws-runtime-e2e"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        AWS_RUNTIME_E2E_ARGS:
          "--dry-run --environment slot.blitz --runtime-kind katana --runtime-name e2e-smoke --domain runtime.example.test",
      },
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(() => JSON.parse(result.stdout)).not.toThrow();
    expect(JSON.parse(result.stdout)).toMatchObject({
      operation: "aws-runtime-e2e",
      status: "planned",
      environmentId: "slot.blitz",
      runtimeKind: "katana",
      runtimeName: "e2e-smoke",
    });

    const payload = JSON.parse(result.stdout) as { steps: Array<{ name: string; command: string[] }> };
    expect(payload.steps.slice(0, 6)).toEqual([
      {
        name: "workflow-guard",
        command: ["pnpm", "run", "check:aws-runtime-workflows"],
      },
      {
        name: "provider-guard",
        command: ["pnpm", "run", "check:aws-runtime-provider"],
      },
      {
        name: "terraform-guard",
        command: ["pnpm", "run", "check:aws-runtime-terraform"],
      },
      {
        name: "readme-guard",
        command: ["pnpm", "run", "check:aws-runtime-readme"],
      },
      {
        name: "url-guard",
        command: ["pnpm", "run", "check:aws-runtime-urls"],
      },
      {
        name: "iam-policy-guard",
        command: ["pnpm", "run", "check:aws-runtime-iam"],
      },
    ]);
    expect(payload.steps[6]?.name).toBe("concurrent-deploy");
    expect(payload.steps[6]?.command[0]).toBe("sh");
    expect(payload.steps[6]?.command.join(" ")).toContain("aws-runtime.ts");
    expect(payload.steps[6]?.command.join(" ")).toContain("'--operation' 'deploy'");

    const auditSteps = payload.steps.filter((step) => step.name.startsWith("resource-audit"));
    expect(auditSteps.map((step) => step.name)).toEqual([
      "resource-audit-after-delete",
      "resource-audit-after-recreate-delete",
    ]);
    for (const step of auditSteps) {
      expect(step.command).toContain("check:aws-runtime-resources");
      expect(step.command).toContain("--environment");
      expect(step.command).toContain("slot.blitz");
      expect(step.command).toContain("--runtime-kind");
      expect(step.command).toContain("katana");
      expect(step.command).toContain("--runtime-name");
      expect(step.command).toContain("e2e-smoke");
    }

    const retainDataDelete = payload.steps.find((step) => step.name === "delete-retain-data");
    expect(retainDataDelete?.command).toEqual(
      expect.arrayContaining(["--operation", "delete", "--retain-data", "true"]),
    );
    expect(payload.steps.map((step) => step.name)).toEqual(
      expect.arrayContaining(["deploy-retained-data", "inspect-retained-data"]),
    );
  });

  test("fails when retained-data recreate does not report a restored snapshot", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "aws-runtime-e2e-retain-"));
    const binDir = path.join(workspace, "bin");
    const inspectCountPath = path.join(workspace, "inspect-count");
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(
      path.join(binDir, "pnpm"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'if [[ "$*" == *"check:aws-runtime-resources"* ]]; then',
        '  printf \'{"operation":"aws-runtime-resource-audit","status":"passed","resources":[]}\\n\'',
        "else",
        "  true",
        "fi",
      ].join("\n"),
    );
    fs.writeFileSync(
      path.join(binDir, "bun"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'operation=""',
        'while [[ "$#" -gt 0 ]]; do',
        '  if [[ "$1" == "--operation" ]]; then operation="$2"; shift 2; continue; fi',
        "  shift",
        "done",
        'if [[ "${operation}" == "inspect" ]]; then',
        '  count="$(cat "${AWS_E2E_INSPECT_COUNT}" 2>/dev/null || printf "0")"',
        '  count="$((count + 1))"',
        '  printf "%s" "${count}" > "${AWS_E2E_INSPECT_COUNT}"',
        '  if [[ "${count}" == "4" ]]; then',
        '    printf \'{"operation":"inspect","liveState":{},"artifact":{}}\\n\'',
        "    exit 0",
        "  fi",
        "fi",
        'printf \'{"operation":"%s","restoredFromSnapshot":"2026-07-04T00:00:00.000Z","liveState":{},"artifact":{}}\\n\' "${operation}"',
      ].join("\n"),
    );
    fs.writeFileSync(
      path.join(binDir, "node"),
      ["#!/usr/bin/env bash", "set -euo pipefail", 'printf \'{"status":"passed"}\\n\''].join("\n"),
    );
    fs.chmodSync(path.join(binDir, "pnpm"), 0o755);
    fs.chmodSync(path.join(binDir, "bun"), 0o755);
    fs.chmodSync(path.join(binDir, "node"), 0o755);

    const result = spawnSync(
      process.execPath,
      [
        "scripts/aws-runtime-e2e.mjs",
        "--environment",
        "slot.blitz",
        "--runtime-kind",
        "katana",
        "--runtime-name",
        "e2e-smoke",
        "--image-digest",
        `sha256:${"a".repeat(64)}`,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          AWS_E2E_INSPECT_COUNT: inspectCountPath,
          PATH: `${binDir}:${process.env.PATH}`,
        },
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toBe("");
    const payload = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(payload).toMatchObject({
      operation: "aws-runtime-e2e",
      status: "failed",
      failureClassification: "runtime-validation",
    });
    expect(payload.errorMessage).toContain("inspect-retained-data");
    expect(payload.errorMessage).toContain("restoredFromSnapshot");
  });

  test("fails when a successful runtime step emits non-json stdout", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "aws-runtime-e2e-json-"));
    const binDir = path.join(workspace, "bin");
    const inspectCountPath = path.join(workspace, "inspect-count");
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(
      path.join(binDir, "pnpm"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'if [[ "$*" == *"check:aws-runtime-resources"* ]]; then',
        '  printf \'{"operation":"aws-runtime-resource-audit","status":"passed","resources":[]}\\n\'',
        "else",
        "  true",
        "fi",
      ].join("\n"),
    );
    fs.writeFileSync(
      path.join(binDir, "bun"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'operation=""',
        'while [[ "$#" -gt 0 ]]; do',
        '  if [[ "$1" == "--operation" ]]; then operation="$2"; shift 2; continue; fi',
        "  shift",
        "done",
        'if [[ "${operation}" == "deploy" ]]; then',
        '  printf "deployment completed\\n"',
        "  exit 0",
        "fi",
        'if [[ "${operation}" == "inspect" ]]; then',
        '  count="$(cat "${AWS_E2E_INSPECT_COUNT}" 2>/dev/null || printf "0")"',
        '  count="$((count + 1))"',
        '  printf "%s" "${count}" > "${AWS_E2E_INSPECT_COUNT}"',
        '  if [[ "${count}" == "3" ]]; then',
        '    printf \'{"operation":"inspect","restoredFromSnapshot":"2026-07-04T00:00:00.000Z","liveState":{"restoredFromSnapshot":"2026-07-04T00:00:00.000Z"},"artifact":{}}\\n\'',
        "    exit 0",
        "  fi",
        "fi",
        'printf \'{"operation":"%s","liveState":{},"artifact":{}}\\n\' "${operation}"',
      ].join("\n"),
    );
    fs.writeFileSync(
      path.join(binDir, "node"),
      ["#!/usr/bin/env bash", "set -euo pipefail", 'printf \'{"status":"passed"}\\n\''].join("\n"),
    );
    fs.chmodSync(path.join(binDir, "pnpm"), 0o755);
    fs.chmodSync(path.join(binDir, "bun"), 0o755);
    fs.chmodSync(path.join(binDir, "node"), 0o755);

    const result = spawnSync(
      process.execPath,
      [
        "scripts/aws-runtime-e2e.mjs",
        "--environment",
        "slot.blitz",
        "--runtime-kind",
        "katana",
        "--runtime-name",
        "e2e-smoke",
        "--image-digest",
        `sha256:${"a".repeat(64)}`,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          AWS_E2E_INSPECT_COUNT: inspectCountPath,
          PATH: `${binDir}:${process.env.PATH}`,
        },
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toBe("");
    const payload = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(payload).toMatchObject({
      operation: "aws-runtime-e2e",
      status: "failed",
      failureClassification: "runtime-validation",
    });
    expect(payload.errorMessage).toContain("concurrent-deploy");
    expect(payload.errorMessage).toContain("valid JSON");
  });
});
