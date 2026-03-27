import fs from "node:fs/promises";
import path from "node:path";

function serializeJsonValue(value) {
  if (typeof value === "bigint") {
    return `0x${value.toString(16)}`;
  }

  return value;
}

export async function readJsonFile(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

export async function readJsonFileIfExists(filePath) {
  try {
    return await readJsonFile(filePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

export async function writeJsonFile(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, (_, value) => serializeJsonValue(value), 2)}\n`);
}

export async function mergeJsonFile(filePath, nextValues) {
  const currentValues = (await readJsonFileIfExists(filePath)) ?? {};
  const mergedValues = {
    ...currentValues,
    ...nextValues,
  };

  await writeJsonFile(filePath, mergedValues);
  return mergedValues;
}
