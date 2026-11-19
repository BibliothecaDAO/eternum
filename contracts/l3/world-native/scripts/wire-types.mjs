export function wireTypeNames(types, roots) {
  const reached = new Set();
  const visit = (value) => {
    if (typeof value === "string") {
      for (const name of [value, ...value.split(/[<>(),\s]+/)]) {
        if (!types.has(name) || reached.has(name)) continue;
        reached.add(name);
        visit(types.get(name));
      }
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(roots);
  return reached;
}

export const wireRoots = ({ models, events, games }, commandAbi, modelStructs) => ({
  models,
  events,
  games,
  commandAbi,
  modelStructs: [...modelStructs],
});
