import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { eventLayouts, uniqueEventLayouts } from "./event-layouts.mjs";

test("Games exposes the published player frame, roles and frozen roster ABI", async () => {
  const { abi } = JSON.parse(
    await readFile(new URL("../target/dev/world_native_Games.contract_class.json", import.meta.url), "utf8"),
  );
  const methods = abi.flatMap((entry) => (entry.type === "interface" ? entry.items : [entry]));
  const method = (name) => {
    const matches = methods.filter((entry) => entry.name === name);
    assert.equal(matches.length, 1, `Expected one Games ${name}`);
    return matches[0];
  };
  assert.deepEqual(method("play").inputs, [
    { name: "game_id", type: "core::integer::u32" },
    { name: "release_id", type: "core::integer::u32" },
    { name: "preset_commitment", type: "core::felt252" },
    { name: "command", type: "core::array::Span::<core::felt252>" },
  ]);
  assert.deepEqual(method("play").outputs, []);
  assert.deepEqual(
    method("constructor").inputs.map(({ name }) => name),
    ["owner", "launcher", "authentication", "release_id", "release", "vrf_public_key", "l2_gas_bound"],
  );
  for (const name of [
    "owner",
    "launcher",
    "ledger_operator",
    "set_launcher",
    "set_ledger_operator",
    "create_game",
    "register_preset",
  ])
    method(name);
  assert.deepEqual(method("create_game").inputs, [
    { name: "params", type: "world_native::registrar::CreateGameParams" },
  ]);
  assert.deepEqual(abi.find(({ name }) => name === "world_native::registrar::RosterPlayer").members, [
    { name: "account", type: "core::starknet::contract_address::ContractAddress" },
    { name: "wallet", type: "core::starknet::contract_address::ContractAddress" },
  ]);
  assert.equal(
    abi.find(({ name }) => name === "world_native::entry::LaborHome").members.find(({ name }) => name === "home").type,
    "core::integer::u64",
  );
  for (const retired of ["publish_frontier_pool", "post_frontier_top", "award_frontier_prize"])
    assert.equal(
      methods.some(({ name }) => name === retired),
      false,
      `${retired} is retired`,
    );
  assert.deepEqual(method("sweep_lords").inputs, [
    { name: "game_id", type: "core::integer::u32" },
    { name: "structure_id", type: "core::integer::u64" },
  ]);
  assert.deepEqual(abi.find(({ name }) => name === "world_native::relics::ChestRules").members, [
    { name: "price_ceiling", type: "core::integer::u128" },
    { name: "shares", type: "world_native::relics::ChestTiers" },
    { name: "claim_window_seconds", type: "core::integer::u32" },
    { name: "pool_bps", type: "core::integer::u16" },
    { name: "top_n", type: "core::integer::u16" },
  ]);
  const relics = JSON.parse(
    await readFile(new URL("../target/dev/world_native_RelicsLogic.contract_class.json", import.meta.url), "utf8"),
  ).abi;
  assert.deepEqual(relics.find(({ name }) => name === "world_native::relics::LordsBudget").members, [
    { name: "pool", type: "core::integer::u128" },
    { name: "pool_left", type: "core::integer::u128" },
    { name: "open", type: "core::integer::u128" },
    { name: "day", type: "core::integer::u64" },
    { name: "price", type: "core::integer::u128" },
    { name: "rolled_shares", type: "core::integer::u128" },
    { name: "yesterday_shares", type: "core::integer::u128" },
    { name: "yesterday_ticks", type: "core::integer::u64" },
  ]);
  assert.equal(
    methods.some(({ name }) => name === "lords_budget"),
    false,
  );
  assert.deepEqual(method("grant_labor").inputs, [
    { name: "home", type: "world_native::entry::LaborHome" },
    { name: "day", type: "core::integer::u64" },
    { name: "account", type: "core::starknet::contract_address::ContractAddress" },
  ]);
  assert.deepEqual(method("grant_labor").outputs, [{ type: "world_native::entry::LaborGrant" }]);
  assert.equal(
    methods.some(({ name }) =>
      /recorded_execution|execution_head|actor_nonce|open_epoch|reveal_epoch/.test(name ?? ""),
    ),
    false,
  );
});

function abi(contract, type) {
  return [
    {
      type: "event",
      name: `${contract}::Event`,
      kind: "enum",
      variants: [{ name: "RowSet", type: `${contract}::RowSet`, kind: "nested" }],
    },
    { type: "event", name: `${contract}::RowSet`, kind: "struct", members: [{ name: "value", type, kind: "data" }] },
  ];
}

test("home rewards have one production implementation and no former-class entrypoints", async () => {
  const entrypoints = async (contract) => {
    const { abi } = JSON.parse(
      await readFile(new URL(`../target/dev/world_native_${contract}.contract_class.json`, import.meta.url), "utf8"),
    );
    return abi.flatMap((entry) => (entry.type === "interface" ? entry.items : [entry])).map(({ name }) => name);
  };
  const { contracts } = JSON.parse(
    await readFile(new URL("../target/dev/world_native.starknet_artifacts.json", import.meta.url), "utf8"),
  );
  const libraries = await Promise.all(
    contracts
      .filter(({ contract_name }) => contract_name.endsWith("Logic"))
      .map(async ({ contract_name }) => [contract_name, await entrypoints(contract_name)]),
  );
  const games = await entrypoints("Games");
  for (const name of [
    "grant_labor",
    "labor_grant",
    "claim_daily_quest",
    "record_quest_progress",
    "bane_effects",
    "resource_context",
  ]) {
    const implementations = libraries.flatMap(([contract, entries]) =>
      entries.filter((entry) => entry === name).map(() => contract),
    );
    assert.deepEqual(implementations, ["BridgeLogic"], `${name} must have exactly one production implementation`);
  }
  for (const name of ["grant_labor", "labor_grant"]) {
    assert.equal(games.filter((entry) => entry === name).length, 1);
  }
});

test("terrain derivation has one implementation in MovementLogic", async () => {
  const { contracts } = JSON.parse(
    await readFile(new URL("../target/dev/world_native.starknet_artifacts.json", import.meta.url), "utf8"),
  );
  const implementations = [];
  for (const { contract_name } of contracts) {
    if (!contract_name.endsWith("Logic")) continue;
    const { abi } = JSON.parse(
      await readFile(
        new URL(`../target/dev/world_native_${contract_name}.contract_class.json`, import.meta.url),
        "utf8",
      ),
    );
    for (const entry of abi) {
      if (entry.type === "interface" && entry.name === "world_native::settlement::ITerrainDerivation") {
        implementations.push(contract_name);
        assert.deepEqual(
          entry.items.map(({ name }) => name),
          ["raise_expedition_home", "biome", "expedition_home_ring"],
        );
      }
    }
  }
  assert.deepEqual(implementations, ["MovementLogic"], "Route terrain through the single MovementLogic implementation");
});

test("libraries sharing a Games selector must agree on every wire member", () => {
  const first = eventLayouts(abi("MapLogic", "core::felt252"));
  const same = eventLayouts(abi("TroopsLogic", "core::felt252"));
  assert.deepEqual(uniqueEventLayouts([...first, ...same]), first);
  const different = eventLayouts(abi("TroopsLogic", "core::integer::u256"));
  assert.throws(() => uniqueEventLayouts([...first, ...different]), /Conflicting event layout/);
  assert.throws(
    () => eventLayouts([...abi("MapLogic", "core::felt252"), ...abi("MapLogic", "core::integer::u256")]),
    /Conflicting event definition/,
  );
});

test("bane effects are read only beside quest progress; callers use the pinned library", async () => {
  const root = new URL("../src/logic/", import.meta.url);
  const readers = [];
  for (const file of await readdir(root)) {
    if (!file.endsWith(".cairo")) continue;
    const source = await readFile(new URL(file, root), "utf8");
    assert.doesNotMatch(
      source,
      /banes::(?:windows|stamina_percent|production_percent)\s*\(/,
      `${file}: use banes::effects so the interval and its rates compile once beside QuestState`,
    );
    if (/banes::read_effects\s*\(/.test(source)) readers.push(file);
  }
  assert.deepEqual(readers, ["quests.cairo"], "only QuestState may compile the bane effect reader");
  const banes = await readFile(new URL("banes.cairo", root), "utf8");
  assert.doesNotMatch(
    banes,
    /logic::game::(?:game|rules)\s*\(|commands::load_context\s*\(/,
    "bane effects must read the seed and calendar fields directly, without a full game context",
  );
});

test("village pass administration has one owner in SettlementLogic", async () => {
  const { contracts } = JSON.parse(
    await readFile(new URL("../target/dev/world_native.starknet_artifacts.json", import.meta.url), "utf8"),
  );
  const owners = [];
  for (const { contract_name } of contracts) {
    if (!contract_name.endsWith("Logic")) continue;
    const { abi } = JSON.parse(
      await readFile(
        new URL(`../target/dev/world_native_${contract_name}.contract_class.json`, import.meta.url),
        "utf8",
      ),
    );
    for (const entry of abi) {
      const methods = entry.type === "interface" ? entry.items : [entry];
      if (methods.some(({ name }) => name === "register_village_pass")) owners.push(contract_name);
    }
  }
  assert.deepEqual(owners, ["SettlementLogic"], "village passes use the game's pinned Settlement class");
});

test("Race eligibility reads only its preset fields", async () => {
  for (const file of ["army_relics", "relics", "lords_budget"]) {
    const source = await readFile(new URL(`../src/logic/${file}.cairo`, import.meta.url), "utf8");
    assert.doesNotMatch(
      source,
      /logic::game::rules\(|commands::load_context\(/,
      `${file}: read preset_record::for_game(...).rules.day_unit_seconds, not the full game context`,
    );
  }
});

test("Race settlement and Triumph evaluation have one Economy library owner", async () => {
  const { contracts } = JSON.parse(
    await readFile(new URL("../target/dev/world_native.starknet_artifacts.json", import.meta.url), "utf8"),
  );
  for (const { contract_name } of contracts) {
    if (!contract_name.endsWith("Logic")) continue;
    const { abi } = JSON.parse(
      await readFile(
        new URL(`../target/dev/world_native_${contract_name}.contract_class.json`, import.meta.url),
        "utf8",
      ),
    );
    const methods = abi.flatMap((entry) => (entry.type === "interface" ? entry.items : [entry]));
    for (const method of ["finalize_race", "triumph_percent", "race_enabled"]) {
      assert.equal(
        methods.filter((entry) => entry.name === method).length,
        contract_name === "EconomyLogic" ? 1 : 0,
        `${method} belongs to the existing Race component in Economy`,
      );
    }
  }
});

test("Triumph callers use the pinned library instead of compiling another reader", async () => {
  const directory = new URL("../src/logic/", import.meta.url);
  const source = await readFile(new URL("triumphs.cairo", directory), "utf8");
  const wrapper = source.slice(source.indexOf("pub fn percent("), source.indexOf("pub fn beast_percent("));
  assert.match(
    wrapper,
    /IRaceDispatcherTrait::triumph_percent/,
    "Triumph callers must dispatch through the game's pinned Economy class",
  );
  assert.doesNotMatch(wrapper, /logic::race::rules/, "Keep the Triumph storage reader behind Economy's library call");
  const callers = [];
  for (const file of await readdir(directory)) {
    if (!file.endsWith(".cairo") || file === "triumphs.cairo") continue;
    const text = await readFile(new URL(file, directory), "utf8");
    if (/\bread_percent\b/.test(text)) callers.push(file);
  }
  assert.deepEqual(callers, [], "Use triumphs::percent; the storage reader is private to Economy's Race component");
});

test("whole rule reads stay private to command loading and Race's Economy implementation", async () => {
  const directory = new URL("../src/", import.meta.url);
  for (const file of await readdir(directory, { recursive: true })) {
    if (!file.endsWith(".cairo")) continue;
    const source = await readFile(new URL(file, directory), "utf8");
    assert.doesNotMatch(
      source,
      /logic::game::rules\b/,
      `${file}: use the command context or read the required preset field`,
    );
    if (file !== "commands.cairo") {
      assert.doesNotMatch(
        source,
        /\brules\s*\.\s*read\s*\(/,
        `${file}: only commands::load_context may load the whole rule set`,
      );
    }
    if (file !== "logic/race.cairo") {
      assert.doesNotMatch(source, /\brace_rules\s*\.\s*read\s*\(/, `${file}: query the pinned Economy Race library`);
      assert.doesNotMatch(
        source,
        /logic::race::(?:rules|hyperstructure)\b/,
        `${file}: query the pinned Economy Race library`,
      );
    }
  }
  const commands = await readFile(new URL("commands.cairo", directory), "utf8");
  assert.match(commands, /\nfn read_rules\(/, "Keep the full rule reader private to commands");
  assert.equal((commands.match(/\bread_rules\(/g) ?? []).length, 2, "Only load_context calls the full rule reader");
  const race = await readFile(new URL("logic/race.cairo", directory), "utf8");
  for (const name of ["rules", "hyperstructure", "triumph_percent"]) {
    assert.match(race, new RegExp(`\\nfn ${name}\\(`), `${name} must remain private to Economy's Race implementation`);
  }
});

test("compiled RaceRules storage reader has exactly one Economy owner", async () => {
  const directory = new URL("../target/dev/", import.meta.url);
  const { contracts } = JSON.parse(await readFile(new URL("world_native.starknet_artifacts.json", directory), "utf8"));
  const owners = [];
  for (const { contract_name } of contracts) {
    if (!contract_name.endsWith("Logic")) continue;
    const { sierra_program_debug_info } = JSON.parse(
      await readFile(new URL(`world_native_${contract_name}.contract_class.json`, directory), "utf8"),
    );
    if (
      sierra_program_debug_info.user_func_names.some(
        ([, name]) => name === "world_native::race::RaceRulesStore::read_at_offset",
      )
    )
      owners.push(contract_name);
  }
  assert.deepEqual(
    owners,
    ["EconomyLogic"],
    "Read scalar Race facts through the pinned Economy library; do not compile another RaceRules reader",
  );
});

test("Bridge operator paths never compile the complete rule reader", async () => {
  const { sierra_program_debug_info } = JSON.parse(
    await readFile(new URL("../target/dev/world_native_BridgeLogic.contract_class.json", import.meta.url), "utf8"),
  );
  const functions = sierra_program_debug_info.user_func_names.map(([, name]) => name);
  assert.equal(
    functions.some(
      (name) =>
        name.endsWith("::logic::game::rules") ||
        (name.includes("SliceRulesStore") && /::read(?:_at_offset)?$/.test(name)),
    ),
    false,
    "Bridge must use preset fields and home_grants::grant_resource_context; sweep_lords defers to the pinned resource context reader only for earned balances",
  );
});

test("Day claim readers fetch only the structure fields they consume", async () => {
  for (const file of ["home_grants", "quests"]) {
    const source = await readFile(new URL(`../src/logic/${file}.cairo`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /structures::record\s*\(/, `${file}: read the structure base and owner directly`);
  }
});

test("Day dispatchers share the pinned release reader", async () => {
  for (const file of ["aspects", "banes", "deposits", "entry", "home_grants", "quests"]) {
    const source = await readFile(new URL(`../src/logic/${file}.cairo`, import.meta.url), "utf8");
    assert.doesNotMatch(
      source,
      /\bgame_releases\b/,
      `${file}: use logic::release::classes(game_id) for the pinned class instead of repeating its storage lookup`,
    );
  }
});

test("starting troops have one implementation in StructuresLogic", async () => {
  const { contracts } = JSON.parse(
    await readFile(new URL("../target/dev/world_native.starknet_artifacts.json", import.meta.url), "utf8"),
  );
  const owners = [];
  for (const { contract_name } of contracts) {
    if (!contract_name.endsWith("Logic")) continue;
    const { abi, sierra_program_debug_info } = JSON.parse(
      await readFile(
        new URL(`../target/dev/world_native_${contract_name}.contract_class.json`, import.meta.url),
        "utf8",
      ),
    );
    const methods = abi.flatMap((entry) => (entry.type === "interface" ? entry.items : [entry]));
    if (methods.some(({ name }) => name === "grant_village_troops")) owners.push(contract_name);
    const names = sierra_program_debug_info.user_func_names.map(([, name]) => name);
    assert.equal(
      names.some(
        (name) =>
          name.includes("structure_actions::grant_starting_troops") || name.includes("structure_actions::biome_troop"),
      ),
      false,
      `${contract_name}: remove the old free grant and biome readers; use pinned IStartingTroops in Structures`,
    );
    if (contract_name === "RegistryLogic") {
      assert.equal(
        names.some((name) => name.includes("world_native::logic::village::rules")),
        false,
        "Registry: read preset.village_delay; the village grant reader belongs beside the grant in Structures",
      );
    }
    assert.equal(
      names.some((name) => name.includes("StructuresLogic::Internal::apply_starting_troops")),
      contract_name === "StructuresLogic",
      `${contract_name}: starting troops must compile only in StructuresLogic`,
    );
  }
  assert.deepEqual(owners, ["StructuresLogic"]);
});

test("full settlement rules compile only where Placement consumes the record", async () => {
  const { contracts } = JSON.parse(
    await readFile(new URL("../target/dev/world_native.starknet_artifacts.json", import.meta.url), "utf8"),
  );
  const owners = [];
  for (const { contract_name } of contracts) {
    if (!contract_name.endsWith("Logic")) continue;
    const { sierra_program_debug_info } = JSON.parse(
      await readFile(
        new URL(`../target/dev/world_native_${contract_name}.contract_class.json`, import.meta.url),
        "utf8",
      ),
    );
    if (
      sierra_program_debug_info.user_func_names.some(([, name]) => name === "world_native::logic::settlement::rules")
    ) {
      owners.push(contract_name);
    }
  }
  assert.deepEqual(
    owners,
    ["PlacementLogic"],
    "Read preset.settlement_spacing, preset.settlement_mode or registrar.roster_sizes directly; only Placement needs the full SettlementRules record",
  );
});

test("Deep lifecycle and bane bodies compile only beside their owning state", async () => {
  const { contracts } = JSON.parse(
    await readFile(new URL("../target/dev/world_native.starknet_artifacts.json", import.meta.url), "utf8"),
  );
  const owners = new Map();
  for (const { contract_name, artifacts } of contracts) {
    if (!contract_name.endsWith("Logic")) continue;
    const { sierra_program_debug_info } = JSON.parse(
      await readFile(new URL(`../target/dev/${artifacts.sierra}`, import.meta.url), "utf8"),
    );
    for (const [, name] of sierra_program_debug_info.user_func_names) {
      const classes = owners.get(name) ?? new Set();
      classes.add(contract_name);
      owners.set(name, classes);
    }
  }
  for (const [body, owner, route] of [
    ["deep_banes::day", "BridgeLogic", "IDeepBanes.height_blocked"],
    ["deep_banes::height_blocked", "BridgeLogic", "IDeepBanes.height_blocked"],
    ["deep_guards::remove", "TroopsLogic", "IBattleResolution.destroy_explorer"],
    ["deep_armies::settle", "TroopsLogic", "IBattleResolution.settle_deep_army"],
    ["troops::expire_explorer", "TroopsLogic", "IBattleResolution.expire_explorer"],
    ["troops::return_homecoming", "TroopsLogic", "IBattleResolution.expire_explorer"],
  ]) {
    assert.deepEqual(
      [...(owners.get(`world_native::logic::${body}`) ?? [])],
      [owner],
      `${body} must compile only in ${owner}; use ${route} from other classes`,
    );
  }
});
