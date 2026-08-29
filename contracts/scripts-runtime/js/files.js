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

function parseEnvironmentKey(line) {
  const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
  return match?.[1];
}

export async function mergeEnvironmentFile(filePath, nextValues) {
  let lines = [];

  try {
    lines = (await fs.readFile(filePath, "utf8")).split(/\r?\n/);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  while (lines.at(-1) === "") lines.pop();

  const lineByKey = new Map();
  lines.forEach((line, index) => {
    const key = parseEnvironmentKey(line);
    if (key) lineByKey.set(key, index);
  });

  for (const [key, value] of Object.entries(nextValues)) {
    const nextLine = `${key}=${value}`;
    const lineIndex = lineByKey.get(key);
    if (lineIndex === undefined) lines.push(nextLine);
    else lines[lineIndex] = nextLine;
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${lines.join("\n")}\n`);
}
