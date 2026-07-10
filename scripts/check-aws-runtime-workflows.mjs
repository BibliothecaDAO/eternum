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
      ["environment identity", ["inputs.environment_id"]],
      ["runtime identity", ["inputs.torii_name"]],
    ],
  },
  {
    label: "factory-indexer-maintenance.yml",
    path:
      process.env.AWS_RUNTIME_WORKFLOW_INDEXER_MAINTENANCE_SOURCE ??
      ".github/workflows/factory-indexer-maintenance.yml",
    checks: [
      ["environment identity", ["github.event.inputs.environment"]],
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
const runtimeImagePromotionWorkflow = {
  label: "aws-runtime-image-promote.yml",
  path: process.env.AWS_RUNTIME_WORKFLOW_IMAGE_PROMOTION_SOURCE ?? ".github/workflows/aws-runtime-image-promote.yml",
};
const runtimeDrWorkflow = {
  label: "aws-runtime-dr.yml",
  path: process.env.AWS_RUNTIME_WORKFLOW_DR_SOURCE ?? ".github/workflows/aws-runtime-dr.yml",
};
const runtimeCiWorkflow = {
  label: "aws-runtime-ci.yml",
  path: process.env.AWS_RUNTIME_WORKFLOW_CI_SOURCE ?? ".github/workflows/aws-runtime-ci.yml",
};
const safetyWorkflows = [
  ...workflowSources,
  runtimeImageWorkflow,
  runtimeE2eWorkflow,
  runtimeImagePromotionWorkflow,
  runtimeDrWorkflow,
  runtimeCiWorkflow,
  {
    label: "game-launch.yml",
    path: process.env.AWS_RUNTIME_WORKFLOW_GAME_LAUNCH_SOURCE ?? ".github/workflows/game-launch.yml",
  },
];
const ecsExecWorkflows = [
  ...workflowSources,
  runtimeE2eWorkflow,
  runtimeDrWorkflow,
  safetyWorkflows.find((workflow) => workflow.label === "game-launch.yml"),
].filter(Boolean);

function main() {
  const failures = [
    ...workflowSources.flatMap(validateWorkflowConcurrency),
    ...validateRuntimeImageWorkflow(runtimeImageWorkflow),
    ...validateRuntimeE2eWorkflow(runtimeE2eWorkflow),
    ...validateImagePromotionWorkflow(runtimeImagePromotionWorkflow),
    ...validateDrWorkflow(runtimeDrWorkflow),
    ...validateRuntimeRegistryPublication(),
    ...ecsExecWorkflows.flatMap(validateSessionManagerSetup),
    ...safetyWorkflows.flatMap(validateWorkflowSafety),
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

function validateRuntimeRegistryPublication() {
  const runtimeDeployer = fs.readFileSync(
    process.env.AWS_RUNTIME_WORKFLOW_RUNTIME_DEPLOYER_SOURCE ?? ".github/workflows/aws-runtime-deployer.yml",
    "utf8",
  );
  const gameLaunch = fs.readFileSync(
    process.env.AWS_RUNTIME_WORKFLOW_GAME_LAUNCH_SOURCE ?? ".github/workflows/game-launch.yml",
    "utf8",
  );
  const indexerMaintenance = fs.readFileSync(
    process.env.AWS_RUNTIME_WORKFLOW_INDEXER_MAINTENANCE_SOURCE ?? ".github/workflows/factory-indexer-maintenance.yml",
    "utf8",
  );

  return [
    ...validateRequiredSnippets("aws-runtime-deployer.yml", runtimeDeployer, [
      [
        "must publish successful mutations to the public registry",
        [
          "Publish runtime registry",
          "INPUT_EXPECTED_DELETE_AFTER",
          "--expected-delete-after",
          "update-runtime-registry.ts",
          "--teardown-result-file",
        ],
      ],
    ]),
    ...validateRequiredSnippets("game-launch.yml", gameLaunch, [
      [
        "must publish launched Slot and AWS endpoints",
        ["Publish launched runtime endpoints", "--launch-summary-directory", "FACTORY_WORKER_ADMIN_SECRET"],
      ],
    ]),
    ...validateRequiredSnippets("factory-indexer-maintenance.yml", indexerMaintenance, [
      [
        "must remove successfully deleted immutable runtimes from the public registry",
        ["Reconcile deleted runtime registry aliases", "--maintenance-result-file", "FACTORY_WORKER_ADMIN_SECRET"],
      ],
    ]),
  ];
}

function validateSessionManagerSetup(workflow) {
  const source = fs.readFileSync(workflow.path, "utf8");
  return source.includes("uses: ./.github/actions/setup-session-manager-plugin")
    ? []
    : [`${workflow.label} must install the pinned Session Manager plugin before ECS Exec`];
}

function validateImagePromotionWorkflow(workflow) {
  const source = fs.readFileSync(workflow.path, "utf8");
  const checks = [
    ["must use protected mainnet environments", ["mainnet.blitz", "mainnet.eternum", "environment:"]],
    ["must verify candidate signatures", ["cosign verify", "certificate-oidc-issuer"]],
    ["must enforce Critical and High scan findings", ["CRITICAL", "HIGH", "SCAN_EXCEPTION_EXPIRES_AT"]],
    ["must require canonical v-prefixed promotion tags", ["promotion_tag must be a canonical v-prefixed"]],
    ["must copy the approved digest into production ECR", ["imagetools create", "target_digest"]],
    ["must sign the production digest", ["cosign sign --yes"]],
  ];

  return validateRequiredSnippets(workflow.label, source, checks);
}

function validateDrWorkflow(workflow) {
  const source = fs.readFileSync(workflow.path, "utf8");
  const checks = [
    ["must run a quarterly schedule", ["schedule:", 'cron: "41 4 1 */3 *"']],
    ["must measure replication readiness", ["aws-runtime-dr.mjs", "status"]],
    ["must measure RTO from before destructive preflight", ["Record recovery start", "recovery_started_at"]],
    ["must require protected mainnet environments", ["mainnet.blitz", "mainnet.eternum", "environment:"]],
    ["must recover services from the registry", ["recover-aws-runtime-from-registry.mjs", "RUNTIME_REGISTRY_URL"]],
    [
      "must preflight destination image digests before promotion",
      [
        "Preflight recovery manifest and replicated images",
        "--operation preflight",
        "AWS_DR_RUNTIME_ECR_REPOSITORY_URL",
      ],
    ],
    [
      "must prepare the destination filesystem immediately before replication",
      ["Prepare destination EFS for replication", "update-file-system-protection", "DISABLED"],
    ],
    [
      "must use destination runtime secrets and CORS policy",
      [
        "AWS_DR_RUNTIME_UPSTREAM_RPC_SECRET_ARN",
        "AWS_DR_RUNTIME_CORS_ORIGINS",
        "AWS_DR_RUNTIME_ALB_DNS_NAMES",
        "AWS_DR_RUNTIME_ALB_HOSTED_ZONE_IDS",
      ],
    ],
  ];

  return validateRequiredSnippets(workflow.label, source, checks);
}

function validateWorkflowSafety(workflow) {
  const source = fs.readFileSync(workflow.path, "utf8");
  return [
    ...validatePinnedActions(workflow.label, source),
    ...validateShellExpressionIsolation(workflow.label, source),
    ...validatePermissions(workflow.label, source),
    ...validateEnvironmentIsolation(workflow.label, source),
    ...validateRetryStableRuntimeIdentity(workflow.label, source),
  ];
}

function validateRetryStableRuntimeIdentity(label, source) {
  if (label !== "game-launch.yml" && label !== "aws-runtime-e2e.yml") {
    return [];
  }

  const failures = [];
  if (source.includes("uuidgen")) {
    failures.push(`${label} must not generate a new runtime instance ID on retry`);
  }
  if (!source.includes("runtime-instance-id.ts") || !source.includes("GITHUB_RUN_ID")) {
    failures.push(`${label} must derive a retry-stable runtime instance ID from the GitHub run`);
  }
  return failures;
}

function validatePinnedActions(label, source) {
  return Array.from(source.matchAll(/^\s*uses:\s*(?<action>[^\s#]+)\s*$/gm))
    .map((match) => match.groups.action)
    .filter((action) => !action.startsWith("./"))
    .filter((action) => !/@[a-f0-9]{40}$/.test(action))
    .map((action) => `${label} action must be pinned to a commit SHA: ${action}`);
}

function validateShellExpressionIsolation(label, source) {
  return extractRunBodies(source)
    .filter((runBody) => runBody.body.includes("${{"))
    .map((runBody) => `${label} run block at line ${runBody.line} interpolates a GitHub expression directly`);
}

function extractRunBodies(source) {
  const lines = source.split("\n");
  const runBodies = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(?<indent>\s*)run:\s*(?<value>.*)$/.exec(lines[index]);
    if (!match) {
      continue;
    }

    const indent = match.groups.indent.length;
    const value = match.groups.value;
    if (value && value !== "|" && value !== ">" && value !== "|-") {
      runBodies.push({ line: index + 1, body: value });
      continue;
    }

    const body = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      if (line.trim() && countIndent(line) <= indent) {
        break;
      }
      body.push(line);
    }
    runBodies.push({ line: index + 1, body: body.join("\n") });
  }

  return runBodies;
}

function validatePermissions(label, source) {
  const failures = [];
  if (/^\s*permissions:\s*write-all\s*$/m.test(source)) {
    failures.push(`${label} must not grant write-all permissions`);
  }
  if (/^\s*(checks|deployments|issues|packages|pull-requests|security-events|statuses):\s*write\s*$/m.test(source)) {
    failures.push(`${label} grants an unsupported write permission`);
  }
  return failures;
}

function validateEnvironmentIsolation(label, source) {
  const failures = [];
  if (/['"]mixed['"]|environment:\s*mixed/.test(source)) {
    failures.push(`${label} must not use a mixed environment boundary`);
  }
  if (label === "factory-indexer-maintenance.yml") {
    for (const snippet of ["SELECTED_ENVIRONMENT", "--expected-environment", "--operations-file"]) {
      if (!source.includes(snippet)) {
        failures.push(`${label} must validate every operation against the selected environment (${snippet})`);
      }
    }
  }
  return failures;
}

function countIndent(line) {
  return /^\s*/.exec(line)?.[0].length ?? 0;
}

function validateRequiredSnippets(label, source, checks) {
  return checks.flatMap(([failure, snippets]) =>
    includesAllSnippets(source, snippets) ? [] : [`${label} ${failure}`],
  );
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
    [
      "must allow only exact non-production candidate environments",
      ["Validate candidate request", "slot.blitz|slot.eternum|slottest.blitz|slottest.eternum"],
    ],
    [
      "must validate dojo_version before writing outputs",
      ["dojo_version must be a canonical v-prefixed release version"],
    ],
    [
      "must bind dojo_version to the digest-pinned Dockerfile",
      ["pinned_dojo_version", "must match the digest-pinned Dockerfile version"],
    ],
  ];

  const violations = checks.flatMap(([failure, snippets]) => {
    return includesAllSnippets(source, snippets) ? [] : [`${workflow.label} ${failure}`];
  });
  const validationIndex = source.indexOf("- name: Validate candidate request");
  const credentialsIndex = source.indexOf("- name: Configure AWS credentials");
  if (validationIndex === -1 || credentialsIndex === -1 || validationIndex > credentialsIndex) {
    violations.push(`${workflow.label} must validate the candidate request before assuming AWS credentials`);
  }
  return violations;
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
