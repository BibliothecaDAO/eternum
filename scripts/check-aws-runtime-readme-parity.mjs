import fs from "node:fs";
import process from "node:process";

const outputsPath = process.env.AWS_RUNTIME_README_OUTPUTS_SOURCE ?? "deploy/aws/terraform/outputs.tf";
const variablesPath = process.env.AWS_RUNTIME_README_VARIABLES_SOURCE ?? "deploy/aws/terraform/variables.tf";
const readmePath = process.env.AWS_RUNTIME_README_SOURCE ?? "deploy/aws/README.md";
const forbiddenVariables = ["AWS_RUNTIME_ECR_IMAGE_DIGEST"];
const defaultForbiddenVariablePaths = [
  ".github/workflows/aws-runtime-deployer.yml",
  ".github/workflows/factory-indexer-maintenance.yml",
  ".github/workflows/factory-torii-deployer.yml",
  ".github/workflows/game-launch.yml",
  "config/deployer/clean/runtime/aws-runtime.ts",
  "deploy/aws/README.md",
];
const forbiddenVariablePaths = resolveForbiddenVariablePaths();
const supportedGithubEnvironments = [
  "slot.blitz",
  "slot.eternum",
  "slottest.blitz",
  "slottest.eternum",
  "mainnet.blitz",
  "mainnet.eternum",
];

function main() {
  const outputVariables = extractTerraformOutputVariables(fs.readFileSync(outputsPath, "utf8"));
  const variables = fs.readFileSync(variablesPath, "utf8");
  const readme = fs.readFileSync(readmePath, "utf8");
  const outputSectionVariables = extractBulletCodeValues(readme, "The important outputs map directly to GitHub");
  const operatorSectionVariables = extractBulletCodeValues(readme, "Operator-set GitHub environment variables:");
  const failures = [
    ...findMissingOutputVariables(outputVariables, outputSectionVariables),
    ...findUnknownOutputVariables(outputVariables, outputSectionVariables),
    ...findMisclassifiedOutputVariables(outputVariables, operatorSectionVariables),
    ...validateEnvironmentChecklist(readme),
    ...validateExactEnvironmentVariable(variables),
    ...validateAccessControlDocs(readme),
    ...validateStorageValidationDocs(readme),
    ...findForbiddenVariableReferences(),
  ];

  if (failures.length === 0) {
    return;
  }

  console.error("AWS runtime README variable parity is incomplete:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

function extractTerraformOutputVariables(source) {
  return Array.from(source.matchAll(/output\s+"(?<name>[^"]+)"/g))
    .map((match) => match.groups.name.toUpperCase())
    .sort();
}

function extractBulletCodeValues(source, heading) {
  const section = extractSectionAfter(source, heading);
  return Array.from(section.matchAll(/^- `(?<name>[A-Z0-9_]+)`/gm))
    .map((match) => match.groups.name)
    .sort();
}

function extractTerraformVariable(source, variableName) {
  const marker = `variable "${variableName}"`;
  const start = source.indexOf(marker);
  if (start === -1) {
    return "";
  }

  const nextVariable = source.indexOf('\nvariable "', start + marker.length);
  return source.slice(start, nextVariable === -1 ? source.length : nextVariable);
}

function extractSectionAfter(source, marker) {
  const start = source.indexOf(marker);
  if (start === -1) {
    return "";
  }

  const afterMarker = source.slice(start);
  const sectionEnd = afterMarker.search(/\n\n(?!- )/);
  return sectionEnd === -1 ? afterMarker : afterMarker.slice(0, sectionEnd);
}

function findMissingOutputVariables(outputVariables, readmeVariables) {
  const readmeSet = new Set(readmeVariables);
  return outputVariables
    .filter((variable) => !readmeSet.has(variable))
    .map((variable) => `README output list missing Terraform output ${variable}`);
}

function findUnknownOutputVariables(outputVariables, readmeVariables) {
  const outputSet = new Set(outputVariables);
  return readmeVariables
    .filter((variable) => !outputSet.has(variable))
    .map((variable) => `README output list includes non-output ${variable}`);
}

function findMisclassifiedOutputVariables(outputVariables, operatorVariables) {
  const outputSet = new Set(outputVariables);
  return operatorVariables
    .filter((variable) => outputSet.has(variable))
    .map((variable) => `README operator-set list includes Terraform output ${variable}`);
}

function validateEnvironmentChecklist(source) {
  const requiredSnippets = [
    "## GitHub Environment Checklist",
    "`slot.blitz`",
    "`slot.eternum`",
    "`slottest.blitz`",
    "`slottest.eternum`",
    "`mainnet.blitz`",
    "`mainnet.eternum`",
    "required reviewers",
    "deployment branch policy = `next`",
  ];

  return requiredSnippets
    .filter((snippet) => !source.includes(snippet))
    .map((snippet) => `README missing GitHub environment checklist snippet: ${snippet}`);
}

function validateExactEnvironmentVariable(source) {
  const variable = extractTerraformVariable(source, "github_environment");
  if (!variable) {
    return ["Terraform must define singular github_environment"];
  }
  return [
    ...(!variable.includes("type        = string") ? ["github_environment must be a string"] : []),
    ...(!variable.includes('!strcontains(var.github_environment, "*")')
      ? ["github_environment must reject wildcard values"]
      : []),
  ];
}

function validateAccessControlDocs(source) {
  const accessControlSection = extractMarkdownSection(source, "## Access Control");
  const requiredSnippets = [
    "## Access Control",
    "one exact",
    "Deploy roles",
    "Maintenance roles",
    "cannot assume",
    "environment cluster",
  ];

  return requiredSnippets
    .filter((snippet) => !accessControlSection.includes(snippet))
    .map((snippet) => `README missing access control snippet: ${snippet}`);
}

function validateStorageValidationDocs(source) {
  const storageSection = extractMarkdownSection(source, "## Storage Validation Results");
  const requiredSnippets = [
    "## Storage Validation Results",
    "crash/restore",
    "24h torii soak",
    "mdbx_copy",
    "RPO/RTO sign-off",
    "mainnet cutover",
    "checkpoint/update",
    "cross-account DR drill",
  ];

  return requiredSnippets
    .filter((snippet) => !storageSection.includes(snippet))
    .map((snippet) => `README missing storage validation snippet: ${snippet}`);
}

function extractMarkdownSection(source, heading) {
  const start = source.indexOf(heading);
  if (start === -1) {
    return "";
  }

  const nextHeading = source.indexOf("\n## ", start + heading.length);
  return source.slice(start, nextHeading === -1 ? source.length : nextHeading);
}

function findForbiddenVariableReferences() {
  return forbiddenVariablePaths.flatMap((filePath) => {
    const source = fs.readFileSync(filePath, "utf8");
    return forbiddenVariables
      .filter((variable) => source.includes(variable))
      .map((variable) => `${filePath} still references retired variable ${variable}`);
  });
}

function resolveForbiddenVariablePaths() {
  const configured = process.env.AWS_RUNTIME_README_FORBIDDEN_VARIABLE_SOURCE_PATHS?.trim();
  if (!configured) {
    return defaultForbiddenVariablePaths;
  }

  return configured
    .split(",")
    .map((filePath) => filePath.trim())
    .filter(Boolean);
}

main();
