import fs from "node:fs";

export function ensureRequiredInputFile(filePath, description) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${description} not found at ${filePath}`);
  }
}
