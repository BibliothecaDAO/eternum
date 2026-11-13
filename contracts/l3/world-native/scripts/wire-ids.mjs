import { readFileSync } from "node:fs";

export const wireIds = JSON.parse(readFileSync(new URL("../schema/wire-ids.json", import.meta.url), "utf8"));

export function validateWireIds(registry, previous) {
  for (const kind of ["commands", "stories"]) {
    const entries = registry[kind];
    if (!Array.isArray(entries)) throw new Error(`Missing ${kind} wire IDs`);
    const names = new Set();
    for (const [id, entry] of entries.entries()) {
      if (entry.id !== id || typeof entry.name !== "string" || typeof entry.retired !== "boolean")
        throw new Error(`Invalid ${kind} wire allocation at ${id}`);
      if (names.has(entry.name)) throw new Error(`Reused ${kind} wire name ${entry.name}`);
      names.add(entry.name);
    }
    for (const entry of previous?.[kind] ?? []) {
      const current = entries[entry.id];
      if (!current || current.name !== entry.name || (entry.retired && !current.retired))
        throw new Error(`Permanent ${kind} wire ID ${entry.id} (${entry.name}) changed or reused`);
    }
  }
}

export function assignWireIds(kind, variants) {
  validateWireIds(wireIds);
  const live = wireIds[kind].filter(({ retired }) => !retired);
  if (live.length !== variants.length || new Set(variants.map(({ name }) => name)).size !== variants.length)
    throw new Error(`${kind} variants must match the live wire registry`);
  return variants.map((variant) => {
    const entry = live.find(({ name }) => name === variant.name);
    if (!entry) throw new Error(`Allocate a permanent ${kind} wire ID for ${variant.name}`);
    return { ...variant, wireId: entry.id };
  });
}

export function renderWireSerde(name, variants) {
  const encode = variants.map(({ name: variant, wireId, type }) => {
    const payload = type === "()" ? "" : " Serde::serialize(value, ref output);";
    return `            ${name}::${variant}(${type === "()" ? "_" : "value"}) => { output.append(${wireId});${payload} },`;
  });
  const decode = Array.from({ length: Math.max(...variants.map(({ wireId }) => wireId)) + 1 }, (_, wireId) => {
    const variant = variants.find((variant) => variant.wireId === wireId);
    if (!variant) return `            ${wireId} => None,`;
    return `            ${wireId} => Some(${name}::${variant.name}(${variant.type === "()" ? "()" : "Serde::deserialize(ref serialized)?"})),`;
  });
  return `pub impl ${name}Serde of Serde<${name}> {
    fn serialize(self: @${name}, ref output: Array<felt252>) {
        match self {
${encode.join("\n")}
        }
    }

    fn deserialize(ref serialized: Span<felt252>) -> Option<${name}> {
        let tag: u32 = Serde::deserialize(ref serialized)?;
        match tag {
${decode.join("\n")}
            _ => None,
        }
    }
}
`;
}
