import { hash } from "starknet";

export function eventLayouts(abi) {
  const events = new Map();
  for (const item of abi.filter((item) => item.type === "event")) {
    const previous = events.get(item.name);
    if (previous && JSON.stringify(previous) !== JSON.stringify(item))
      throw new Error(`Conflicting event definition ${item.name}`);
    events.set(item.name, item);
  }
  const roots = [...events.values()].filter(
    (item) => item.kind === "enum" && /(?:Games|Logic)::Event$/.test(item.name),
  );
  if (!roots.length) throw new Error("Missing contract event root");
  const layouts = [];
  function visit(event, prefix) {
    if (event.kind === "enum") {
      for (const variant of event.variants) {
        visit(
          events.get(variant.type),
          variant.kind === "flat" ? prefix : [...prefix, hash.getSelectorFromName(variant.name)],
        );
      }
      return;
    }
    const name = event.name.split("::").at(-1);
    if (
      ![
        "RowSet",
        "RowMemberSet",
        "RowDeleted",
        "BattleEvent",
        "StoryEvent",
        "RaidEvent",
        "PointsAwarded",
        "ExecutionRecorded",
        "BatchProgress",
      ].includes(name)
    )
      throw new Error(`Unexpected event ${name}`);
    layouts.push({ name, prefix, members: event.members });
  }
  for (const root of roots) visit(root, []);
  return uniqueEventLayouts(layouts);
}

/** Every library emits at Games: one selector prefix must have exactly one wire layout. */
export function uniqueEventLayouts(layouts) {
  const byPrefix = new Map();
  for (const layout of layouts) {
    const key = layout.prefix.map((felt) => BigInt(felt).toString(16)).join(":");
    const previous = byPrefix.get(key);
    if (previous && JSON.stringify(previous.members) !== JSON.stringify(layout.members))
      throw new Error(`Conflicting event layout at ${key}: ${previous.name} / ${layout.name}`);
    if (!previous) byPrefix.set(key, layout);
  }
  return [...byPrefix.values()];
}
