import fs from "node:fs";
import path from "node:path";
import { json } from "starknet";

import { MAX_CLASS_FELTS } from "./class-limits.js";

function ensureArtifactExists(filePath, description) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${description} not found at ${filePath}`);
  }
}

export function getContractArtifactPaths(targetDir, projectName, contractName) {
  const baseName = `${projectName}_${contractName}`;
  const sierraPath = path.join(targetDir, `${baseName}.contract_class.json`);
  const compiledPath = path.join(targetDir, `${baseName}.compiled_contract_class.json`);

  ensureArtifactExists(sierraPath, `${contractName} Sierra artifact`);
  ensureArtifactExists(compiledPath, `${contractName} compiled artifact`);

  return {
    compiledPath,
    sierraPath,
  };
}

export function readContractArtifacts({ sierraPath, compiledPath }) {
  const artifacts = {
    casm: json.parse(fs.readFileSync(compiledPath).toString("ascii")),
    contract: json.parse(fs.readFileSync(sierraPath).toString("ascii")),
  };
  assertProgramSize(artifacts.contract.sierra_program, "Sierra");
  assertProgramSize(artifacts.casm.bytecode, "CASM");
  return artifacts;
}

function assertProgramSize(program, kind) {
  if (!Array.isArray(program) || !program.length) throw new Error(`Missing ${kind} program`);
  if (program.length > MAX_CLASS_FELTS)
    throw new Error(`${kind} class exceeds Starknet felt limit (${MAX_CLASS_FELTS})`);
}
