import { commandRoutes } from "../schema/command-routes.mjs";

// Replaces separately maintained command payload types, discriminants and the dispatch match.
export function compileCommandRoutes(artifacts, types, feltLength) {
  const logic = types.get("games_storage::release::LogicClasses").members.map(({ name }) => name);
  const routes = commandRoutes.map((route) => compileRoute(route, artifacts, types, logic, feltLength));
  if (new Set(routes.map(({ name }) => name)).size !== routes.length) throw new Error("Duplicate command name");
  const command = {
    type: "enum",
    name: "world_native::commands::Command",
    variants: routes.map(({ name, payload }) => ({ name, type: payload })),
  };
  return { command, cairo: renderRoutes(routes, logic) };
}

function compileRoute(route, artifacts, types, logic, feltLength) {
  const methods = artifacts[route.logic].flatMap((item) => (item.type === "interface" ? item.items : []));
  const matches = methods.filter(({ name }) => name === route.entrypoint);
  if (matches.length !== 1) throw new Error(`Missing or ambiguous command entrypoint ${route.entrypoint}`);
  const { inputs } = matches[0];
  if (
    ![4, 5].includes(inputs.length) ||
    inputs[0].type !== "core::integer::u32" ||
    inputs[1].type !== "core::starknet::contract_address::ContractAddress" ||
    inputs.at(-2).type !== "world_native::commands::ActionContext" ||
    inputs.at(-1).type !== "world_native::ownership::StoryCursor"
  )
    throw new Error(`Invalid command entrypoint signature ${route.entrypoint}`);
  const payload = inputs.length === 5 ? inputs[2].type : "()";
  const classIndex = logic.indexOf(route.logic);
  if (classIndex < 0) throw new Error(`Unknown command logic ${route.logic}`);
  return {
    ...route,
    payload,
    classIndex,
    itemsOffset: itemOffset(route, payload, types, feltLength),
  };
}

function itemOffset(route, payload, types, feltLength) {
  if (!route.items) return null;
  if (route.items === ".") {
    if (!isSpan(payload)) throw new Error(`Expected a list payload for ${route.name}`);
    return 0;
  }
  let offset = 0;
  for (const member of types.get(payload)?.members ?? []) {
    if (member.name === route.items) {
      if (!isSpan(member.type)) throw new Error(`Expected a list at ${route.name}.${route.items}`);
      return offset;
    }
    const width = feltLength(member.type);
    if (width === null) throw new Error(`Variable field before the bounded list: ${member.type}`);
    offset += width;
  }
  throw new Error(`Missing bounded list ${route.name}.${route.items}`);
}

const isSpan = (type) => /^core::array::(?:Span|Array)::</.test(type);

function renderRoutes(routes, logic) {
  const definitions = routes.map(
    ({ classIndex, entrypoint, itemsOffset, batch }) =>
      `    CommandRoute { logic: ${classIndex}, selector: selector!("${entrypoint}"), items_offset: ${itemsOffset === null ? "None" : `Some(${itemsOffset})`}, batch: ${Boolean(batch)} },`,
  );
  const variants = routes.map(({ name, payload }) =>
    payload === "()"
      ? `    ${name},`
      : `    ${name}: ${payload.replaceAll("world_native::", "crate::").replaceAll("core::starknet::", "starknet::")},`,
  );
  return `// Generated from schema/command-routes.mjs and production logic ABIs.
use starknet::storage::StoragePointerReadAccess;

#[derive(Copy, Drop)]
pub struct CommandRoute {
    pub logic: u8,
    pub selector: felt252,
    pub items_offset: Option<u32>,
    pub batch: bool,
}

pub const SETTLE_BLITZ_ROSTER: u32 = ${routes.findIndex(({ name }) => name === "SettleBlitzRoster")};

pub const COMMAND_ROUTES: [CommandRoute; ${routes.length}] = [
${definitions.join("\n")}
];

pub fn logic_class(classes: starknet::storage::StoragePointer<games_storage::release::LogicClasses>, index: u8) -> starknet::ClassHash {
    match index {
${logic.map((name, index) => `        ${index} => classes.${name}.read(),`).join("\n")}
        _ => panic!("unknown command logic"),
    }
}

// Tests construct typed actions; production forwards their existing Cairo wire fields.
#[cfg(test)]
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum Command {
${variants.join("\n")}
}
`;
}
