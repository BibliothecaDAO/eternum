import fs from "node:fs";
import process from "node:process";

const workflowSources = [
  {
    label: "aws-runtime-deployer.yml",
    path: process.env.AWS_RUNTIME_WORKFLOW_RUNTIME_DEPLOYER_SOURCE ?? ".github/workflows/aws-runtime-deployer.yml",
    checks: [
      ["environment identity", ["inputs.environment || github.event.inputs.environment"]],
      ["runtime identity", ["inputs.runtime_name ||", "github.event.inputs.runtime_name"]],
    ],
  },
  {
    label: "factory-torii-deployer.yml",
    path: process.env.AWS_RUNTIME_WORKFLOW_FACTORY_TORII_SOURCE ?? ".github/workflows/factory-torii-deployer.yml",
    checks: [
      [
        "environment identity",
        ["inputs.environment_id", "github.event.inputs.environment_id", "github.event.inputs.env == 'mainnet'"],
      ],
      [
        "runtime identity",
        [
          "inputs.torii_name ||",
          "github.event.inputs.torii_name",
          "inputs.torii_prefix ||",
          "github.event.inputs.torii_prefix",
        ],
      ],
    ],
  },
  {
    label: "factory-indexer-maintenance.yml",
    path:
      process.env.AWS_RUNTIME_WORKFLOW_INDEXER_MAINTENANCE_SOURCE ??
      ".github/workflows/factory-indexer-maintenance.yml",
    checks: [
      ["environment identity", ["inputs.environment || github.event.inputs.environment || 'mixed'"]],
      ["maintenance scope", ["-maintenance"]],
    ],
  },
];
const runtimeImageWorkflow = {
  label: "aws-runtime-image.yml",
  path: process.env.AWS_RUNTIME_WORKFLOW_RUNTIME_IMAGE_SOURCE ?? ".github/workflows/aws-runtime-image.yml",
};
const runtimeE2eWorkflow = {
  label: "aws-runtime-e2e.yml",
  path: process.env.AWS_RUNTIME_WORKFLOW_E2E_SOURCE ?? ".github/workflows/aws-runtime-e2e.yml",
};

function main() {
  const failures = [
    ...workflowSources.flatMap(validateWorkflowConcurrency),
    ...validateRuntimeImageWorkflow(runtimeImageWorkflow),
    ...validateRuntimeE2eWorkflow(runtimeE2eWorkflow),
  ];

  if (failures.length === 0) {
    return;
  }

  console.error("AWS runtime workflow concurrency checks failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

function validateRuntimeE2eWorkflow(workflow) {
  const source = fs.readFileSync(workflow.path, "utf8");
  const checks = [
    ["must run on a nightly schedule", ["schedule:", "cron:"]],
    ["must support manual workflow dispatch", ["workflow_dispatch:"]],
    ["must validate both runtime engines", ["runtime_kind:", "katana", "torii"]],
    ["must run make aws-runtime-e2e", ["make aws-runtime-e2e"]],
    ["must request OIDC id-token permission", ["permissions:", "id-token: write"]],
    ["must configure AWS credentials", ["aws-actions/configure-aws-credentials", "role-to-assume:", "aws-region:"]],
    [
      "must upload the e2e JSON artifact",
      ["actions/upload-artifact", "aws-runtime-e2e-result", "aws-runtime-e2e-result.json"],
    ],
  ];

  return checks.flatMap(([failure, snippets]) => {
    return includesAllSnippets(source, snippets) ? [] : [`${workflow.label} ${failure}`];
  });
}

function validateRuntimeImageWorkflow(workflow) {
  const source = fs.readFileSync(workflow.path, "utf8");
  const checks = [
    ["push trigger must include deploy/aws/runtime-image/**", ['"deploy/aws/runtime-image/**"']],
    ["must read AWS_RUNTIME_ECR_REPOSITORY_URL", ["AWS_RUNTIME_ECR_REPOSITORY_URL"]],
    ["must publish linux/amd64 images", ["platforms: linux/amd64"]],
    ["must push the image", ["push: true"]],
    ["must expose the pushed image digest", ["image_digest:", "steps.build.outputs.digest"]],
    ["must summarize the pushed image digest", ["Digest:", "steps.build.outputs.digest", "GITHUB_STEP_SUMMARY"]],
    ["tag must include DOJO_VERSION and the git sha", ['image_tag="${DOJO_VERSION}-${short_sha}"']],
    ["must request OIDC id-token permission", ["permissions:", "id-token: write"]],
    ["must configure AWS credentials", ["aws-actions/configure-aws-credentials", "role-to-assume:", "aws-region:"]],
    ["must login to ECR before pushing", ["aws-actions/amazon-ecr-login"]],
  ];

  return checks.flatMap(([failure, snippets]) => {
    return includesAllSnippets(source, snippets) ? [] : [`${workflow.label} ${failure}`];
  });
}

function validateWorkflowConcurrency(workflow) {
  const source = fs.readFileSync(workflow.path, "utf8");
  const concurrency = extractConcurrencyBlock(source);
  if (!concurrency) {
    return [`${workflow.label} must define workflow concurrency`];
  }

  return [
    ...validateConcurrencyCancellation(workflow.label, concurrency),
    ...validateRuntimeGroupPrefix(workflow.label, concurrency),
    ...validateConcurrencyIdentity(workflow, concurrency),
  ];
}

function includesAllSnippets(source, snippets) {
  const normalizedSource = normalizeWhitespace(source);
  return snippets.every((snippet) => normalizedSource.includes(normalizeWhitespace(snippet)));
}

function extractConcurrencyBlock(source) {
  const blockStart = source.indexOf("\nconcurrency:");
  if (blockStart === -1) {
    return null;
  }

  const afterConcurrency = source.slice(blockStart + 1);
  const blockEnd = afterConcurrency.search(/\n(?:env|jobs|permissions):/);
  return blockEnd === -1 ? afterConcurrency : afterConcurrency.slice(0, blockEnd);
}

function validateConcurrencyCancellation(label, concurrency) {
  if (concurrency.includes("cancel-in-progress: false")) {
    return [];
  }

  return [`${label} concurrency must keep cancellation disabled`];
}

function validateRuntimeGroupPrefix(label, concurrency) {
  if (concurrency.includes("aws-runtime-")) {
    return [];
  }

  return [`${label} concurrency group must use the aws-runtime prefix`];
}

function validateConcurrencyIdentity(workflow, concurrency) {
  const normalizedConcurrency = normalizeWhitespace(concurrency);

  return workflow.checks.flatMap(([name, snippets]) => {
    const includesIdentity = snippets.every((snippet) => normalizedConcurrency.includes(normalizeWhitespace(snippet)));
    return includesIdentity ? [] : [`${workflow.label} concurrency group must include ${name}`];
  });
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

main();
