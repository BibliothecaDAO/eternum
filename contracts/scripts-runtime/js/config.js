import fs from "node:fs";

export function loadJsonConfigFile(configFilePath) {
  return JSON.parse(fs.readFileSync(configFilePath, "utf8"));
}

export function requireAddressConfigValue(value, label) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required deployment config value for ${label}`);
  }

  return `${value}`;
}

export function requireBigIntConfigValue(value, label) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required deployment config value for ${label}`);
  }

  return BigInt(value);
}

export function optionalBigIntConfigValue(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return BigInt(value);
}
