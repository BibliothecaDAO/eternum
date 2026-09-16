import type { NativeSchema } from "../../../../apps/herald/src/native/schema";

// These are source adapters for the pinned oracle; native fact names and fields come from its generated schema.
const recordTypes: Record<string, [string, string]> = {
  RealmTraits: ["realms::RealmTraits", "OracleRealmTraits"],
  SettlementPool: ["settlement::SettlementPool", "OracleSettlementPool"],
  SettlementProgress: ["settlement::SettlementProgress", "OracleSettlementProgress"],
  PlayerEntry: ["settlement::PlayerEntry", "ledger::PlayerSettlement"],
  PlayerCosmetics: ["settlement::PlayerCosmetics", "config::BlitzCosmeticAttrsRegister"],
  AgentPopulation: ["troops::AgentPopulation", "agent::AgentCount"],
  UpgradeLimits: ["upgrades::UpgradeLimits", "config::StructureMaxLevelConfig"],
  UpgradeRecipe: ["upgrades::UpgradeRecipe", "OracleUpgradeRecipe"],
  AddressName: ["names::AddressName", "name::AddressName"],
  Structure: ["structures::Structure", "structure::Structure"],
  ResourceProduction: ["resources::Production", "resource::production::production::Production"],
  ResourceArrival: ["arrivals::Arrival", "OracleResourceArrival"],
  ResourceWeight: ["resources::Weight", "weight::Weight"],
  ExplorerTroops: ["troops::ExplorerTroops", "troop::ExplorerTroops"],
  TileOpt: ["map::TileOpt", "map2::TileOpt"],
  Building: ["buildings::Building", "resource::production::building::Building"],
  StructureBuildings: ["buildings::StructureBuildings", "resource::production::building::StructureBuildings"],
  Hyperstructure: ["structures::Hyperstructure", "hyperstructure::Hyperstructure"],
  WonderFaith: ["ownership::WonderFaith", "faith::WonderFaith"],
  FaithfulStructure: ["ownership::FaithfulStructure", "faith::FaithfulStructure"],
  PlayerFaithPoints: ["ownership::PlayerFaithPoints", "faith::PlayerFaithPoints"],
  WonderFaithWinners: ["ownership::WonderFaithWinners", "faith::WonderFaithWinners"],
};

export function factProjectors(schema: NativeSchema): string {
  const implementations: string[] = [];
  for (const model of schema.models) {
    if (!model.observation) continue;
    const pair = recordTypes[model.name];
    if (!pair) continue;
    for (const world of ["native", "oracle"] as const) {
      const type =
        world === "native"
          ? `world_native::${pair[0]}`
          : pair[1].startsWith("Oracle")
            ? `Oracle${model.name}`
            : `crate::models::${pair[1]}`;
      const fields = Object.values(model.observation.fields).flatMap((path) => {
        if (model.observation.transform === "production" && path === "last_updated_at")
          return ["facts.append(if self.building_count == 0 { 0 } else { self.last_updated_at.into() });"];
        const type = memberType(model.members, path.split("."));
        return emitValue(
          `self.${world === "oracle" && model.name === "PlayerCosmetics" ? "attrs" : path}`,
          type,
          world,
        );
      });
      const body =
        model.name === "UpgradeRecipe" && world === "oracle"
          ? `
        let game: crate::models::game::GameRegistry = self.world.read_model(self.game_id);
        let recipe: crate::models::config::StructureLevelConfig = self.world.read_model((game.preset_id, self.level));
        facts.append(recipe.required_resource_count.into());
        for index in 0..recipe.required_resource_count {
          let cost: crate::models::resource::resource::ResourceList = self.world.read_model((game.preset_id, recipe.required_resources_id, index));
          facts.append(cost.resource_type.into()); facts.append(cost.amount.into());
        }`
          : model.name === "SettlementPool" && world === "oracle"
            ? `
        let config: crate::models::config::BlitzSettlementConfig = crate::models::config::WorldConfigUtilImpl::get_member(self.world, self.game_id, selector!("blitz_settlement_config"));
        facts.append(config.open_settlement_count.into());
        for index in 0..config.open_settlement_count {
          let location: crate::models::config::BlitzSettlementPosition = self.world.read_model((self.game_id, index + 1));
          location.coords.serialize(ref facts);
        }`
            : model.observation.transform === "tile"
              ? tileProjection(world)
              : fields.join("\n");
      implementations.push(`impl ${world}_${model.name} of Observable<${type}> {
        fn observe(self: ${type}) -> Array<felt252> { let mut facts = array![]; ${body} facts }
      }`);
    }
  }
  return `// Generated from native schema fact declarations; regenerate with the behavioural parity command.
    use dojo::model::ModelStorage;
    use crate::models::resource::resource::ResourceImpl;
    #[derive(Copy, Drop)]
    pub struct OracleResourceArrival { pub resources: Span<(u8, u128)> }
    #[derive(Copy, Drop)]
    pub struct OracleRealmTraits { pub wonder: u8, pub order: u8, pub resources: Span<u8> }
    #[derive(Copy, Drop)]
    pub struct OracleSettlementPool { pub world: dojo::world::WorldStorage, pub game_id: u32 }
    #[derive(Copy, Drop)]
    pub struct OracleSettlementProgress { pub registered: u16, pub realm_count: u16 }
    #[derive(Copy, Drop)]
    pub struct OracleUpgradeRecipe { pub world: dojo::world::WorldStorage, pub game_id: u32, pub level: u8 }
    pub trait Observable<T> { fn observe(self: T) -> Array<felt252>; }
    ${implementations.join("\n")}
    impl Scalar128 of Observable<u128> { fn observe(self: u128) -> Array<felt252> { array![self.into()] } }
    impl Scalar32 of Observable<u32> { fn observe(self: u32) -> Array<felt252> { array![self.into()] } }
    impl Address of Observable<starknet::ContractAddress> { fn observe(self: starknet::ContractAddress) -> Array<felt252> { array![self.into()] } }
    impl OraclePoints of Observable<crate::models::hyperstructure::PlayerRegisteredPoints> {
      fn observe(self: crate::models::hyperstructure::PlayerRegisteredPoints) -> Array<felt252> { array![self.registered_points.into()] }
    }
    impl OracleTotal of Observable<crate::models::season::SeasonPrize> {
      fn observe(self: crate::models::season::SeasonPrize) -> Array<felt252> { array![self.total_registered_points.into()] }
    }
    impl OracleDiscovered of Observable<crate::models::hyperstructure::HyperstructureGlobals> {
      fn observe(self: crate::models::hyperstructure::HyperstructureGlobals) -> Array<felt252> { array![self.created_count.into()] }
    }
    impl OracleAgent of Observable<crate::models::agent::AgentOwner> {
      fn observe(self: crate::models::agent::AgentOwner) -> Array<felt252> { array![self.address.into()] }
    }`;

  function memberType(members: { name: string; type: string }[], path: string[]): string {
    const member = members.find((member) => member.name === path[0]);
    if (!member) throw new Error(`Unknown fact field ${path.join(".")}`);
    if (path.length === 1) return member.type;
    const definition = schema.types[member.type];
    if (definition?.type !== "struct") throw new Error(`Fact path descends into ${member.type}`);
    return memberType(definition.members, path.slice(1));
  }

  function emitValue(expression: string, type: string, world: "native" | "oracle"): string[] {
    if (/^core::array::(Span|Array)::</.test(type)) return [`${expression}.serialize(ref facts);`];
    const definition = schema.types[type];
    if (definition?.type === "struct")
      return definition.members.flatMap((member) => emitValue(`${expression}.${member.name}`, member.type, world));
    if (definition?.type === "enum" && type !== "core::bool") {
      if (!definition.variants.every((variant) => variant.type === "()"))
        throw new Error(`Unsupported fact enum ${type}`);
      const enumType = world === "native" ? type : oracleEnum(type);
      return [
        `facts.append(match ${expression} { ${definition.variants.map((variant) => `${enumType}::${variant.name} => '${variant.name}'`).join(",")} });`,
      ];
    }
    return [`${expression}.serialize(ref facts);`];
  }
}

function oracleEnum(type: string): string {
  if (type.startsWith("world_native::troops::"))
    return type.replace("world_native::troops::", "crate::models::troop::");
  if (type === "world_native::structures::ConstructionAccess")
    return "crate::models::hyperstructure::ConstructionAccess";
  return type;
}

function tileProjection(world: "native" | "oracle"): string {
  if (world === "oracle")
    return `
    let biome = crate::models::map2::TileOptDataReadImpl::biome(self.data);
    facts.append((biome != 0).into());
    facts.append(biome.into());
    facts.append(crate::models::map2::TileOptDataReadImpl::occupier_type(self.data).into());
    facts.append(crate::models::map2::TileOptDataReadImpl::occupier_id(self.data).into());
    facts.append(crate::models::map2::TileOptDataReadImpl::reward_extracted(self.data).into());
  `;
  return [
    "const BIOME_SCALE: u128 = 0x20000000000;",
    "const ENTITY_SCALE: u128 = 512;",
    "const ENTITY_RANGE: u128 = 0x100000000;",
    "const REWARD_FLAG: u128 = 0x20000000000000000000000000000;",
    "facts.append(((self.data / BIOME_SCALE) % 256 != 0).into());",
    "facts.append(((self.data / BIOME_SCALE) % 256).into());",
    "facts.append(((self.data / 2) % 256).into());",
    "facts.append(((self.data / ENTITY_SCALE) % ENTITY_RANGE).into());",
    "facts.append(((self.data / REWARD_FLAG) % 2).into());",
  ].join("\n");
}
