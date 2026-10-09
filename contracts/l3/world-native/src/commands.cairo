use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct CreateExplorer {
    pub structure_id: u64,
    pub category: u8,
    pub tier: u8,
    pub amount: u128,
    pub direction: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Explore {
    pub explorer_id: u64,
    pub direction: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Battle {
    pub attacker_id: u64,
    pub defender_id: u64,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Move {
    pub explorer_id: u64,
    pub directions: Span<u8>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ToggleAlternate {
    pub explorer_id: u64,
    pub spire_direction: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct EnterDepth {
    pub explorer_id: u64,
    pub depth: u8,
}

#[derive(Drop, starknet::Event)]
pub struct BatchProgress {
    #[key]
    pub game_id: u32,
    pub actor: ContractAddress,
    pub tx_hash: felt252,
    pub remaining: u64,
}
pub use crate::command_routes::Command;

#[derive(Copy, Drop, Debug)]
pub struct ExecutionContext {
    pub raw_root: u256,
    pub timestamp: u64,
    pub game: Box<crate::game::GameRegistry>,
    pub rules: Box<crate::rules::SliceRules>,
}

#[cfg(test)]
impl ExecutionContextSerde of Serde<ExecutionContext> {
    fn serialize(self: @ExecutionContext, ref output: Array<felt252>) {
        self.raw_root.serialize(ref output);
        self.timestamp.serialize(ref output);
        self.game.unbox().serialize(ref output);
        self.rules.unbox().serialize(ref output);
    }

    fn deserialize(ref serialized: Span<felt252>) -> Option<ExecutionContext> {
        Some(
            ExecutionContext {
                raw_root: Serde::deserialize(ref serialized)?,
                timestamp: Serde::deserialize(ref serialized)?,
                game: BoxTrait::new(Serde::deserialize(ref serialized)?),
                rules: BoxTrait::new(Serde::deserialize(ref serialized)?),
            },
        )
    }
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ActionContext {
    pub raw_root: u256,
    pub timestamp: u64,
}

pub fn action_context(context: ExecutionContext) -> ActionContext {
    ActionContext { raw_root: context.raw_root, timestamp: context.timestamp }
}

pub fn load_context(game_id: u32, context: ActionContext) -> ExecutionContext {
    ExecutionContext {
        raw_root: context.raw_root,
        timestamp: context.timestamp,
        game: BoxTrait::new(crate::logic::game::game(game_id)),
        rules: BoxTrait::new(crate::logic::game::rules(game_id)),
    }
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ResourceContext {
    pub production_start: u32,
    pub troop_capacity: u32,
    pub spire_fee: u128,
    pub delivery_tick: u64,
}

pub fn resource_context(context: ExecutionContext) -> ResourceContext {
    ResourceContext {
        production_start: if crate::rules::rule_enabled(context.rules.unbox(), crate::rules::PRODUCTION_START) {
            context.game.unbox().start_main_at.try_into().unwrap()
        } else {
            0
        },
        troop_capacity: context.rules.unbox().capacity_config.troop_capacity,
        spire_fee: context.rules.unbox().spire_travel_essence_cost,
        delivery_tick: context.rules.unbox().tick_config.delivery_tick_in_seconds,
    }
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct BiomeContext {
    pub climate: crate::rules::BiomeClimateConfig,
    pub day_unit_seconds: u32,
    pub start_main_at: u64,
}

pub fn biome_context(context: ExecutionContext) -> BiomeContext {
    BiomeContext {
        climate: context.rules.unbox().biome_climate_config,
        day_unit_seconds: context.rules.unbox().day_unit_seconds,
        start_main_at: context.game.unbox().start_main_at,
    }
}

pub const MAX_COMMAND_ITEMS: u32 = 64;

pub fn route_command(
    mut arguments: Span<felt252>,
) -> Result<(u32, crate::command_routes::CommandRoute, Span<felt252>), felt252> {
    if arguments.len() > 256 {
        return Err('INVALID_COMMAND');
    }
    let index: u32 = (*arguments.pop_front().ok_or('INVALID_COMMAND')?).try_into().ok_or('INVALID_COMMAND')?;
    let routes = crate::command_routes::COMMAND_ROUTES.span();
    let route = **routes.get(index).ok_or('INVALID_COMMAND')?;
    if let Some(offset) = route.items_offset {
        let items: u32 = (**arguments.get(offset).ok_or('INVALID_COMMAND')?).try_into().ok_or('INVALID_COMMAND')?;
        if items > MAX_COMMAND_ITEMS {
            return Err('INVALID_COMMAND');
        }
    }
    Ok((index, route, arguments))
}

#[inline(never)]
pub fn assert_unique_entity_ids(ids: Span<u64>) {
    let mut seen: core::dict::Felt252Dict<u128> = Default::default();
    for id in ids {
        let key = (*id).into();
        assert!(seen.get(key) == 0, "duplicate entity id");
        seen.insert(key, 1);
    }
}

#[starknet::interface]
pub trait ICreateExplorer<T> {
    fn create_explorer(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: CreateExplorer,
        context: crate::commands::ActionContext,
    );
}

#[starknet::interface]
pub trait IExplore<T> {
    fn explore(
        ref self: T, game_id: u32, actor: ContractAddress, command: Explore, context: crate::commands::ActionContext,
    );
}

#[starknet::interface]
pub trait IResourceCommands<T> {
    fn send_resources(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: crate::resources::ResourceTransfer,
        context: crate::commands::ActionContext,
    );
    fn transfer_explorer_resources_to_structure(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: crate::resources::ResourceTransfer,
        context: crate::commands::ActionContext,
    );
    fn offload_arrival(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: crate::arrivals::OffloadArrival,
        context: crate::commands::ActionContext,
    );
    fn burn_structure_resources(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: crate::resources::ResourceBurn,
        context: crate::commands::ActionContext,
    );
    fn transfer_explorer_resources(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: crate::resources::ResourceTransfer,
        context: crate::commands::ActionContext,
    );
    fn transfer_structure_resources_to_explorer(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: crate::resources::ResourceTransfer,
        context: crate::commands::ActionContext,
    );
}

#[starknet::interface]
pub trait ITravelCommands<T> {
    fn enter_depth(
        ref self: T, game_id: u32, actor: ContractAddress, command: EnterDepth, context: crate::commands::ActionContext,
    );
    fn move_explorer(
        ref self: T, game_id: u32, actor: ContractAddress, command: Move, context: crate::commands::ActionContext,
    );
    fn toggle_alternate(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: ToggleAlternate,
        context: crate::commands::ActionContext,
    );
}

#[derive(Drop, Serde)]
pub struct Rejection {
    pub status_class: felt252,
    pub reason: ByteArray,
}

pub fn rejection(code: felt252) -> Rejection {
    Rejection { status_class: code, reason: short_reason(code) }
}

pub fn short_reason(word: felt252) -> ByteArray {
    let mut remaining: u256 = word.into();
    let mut len = 0;
    while remaining != 0 {
        remaining /= 256;
        len += 1;
    }
    let mut reason = "";
    reason.append_word(word, len);
    reason
}

// A failing library call rolls back its own storage and events; its caller records the rejection without reverting.
pub fn domain_rejection(error: Array<felt252>) -> Rejection {
    let mut fields = error.span();
    let reason = match fields.pop_front() {
        Some(word) => if *word == core::byte_array::BYTE_ARRAY_MAGIC {
            Serde::<ByteArray>::deserialize(ref fields).unwrap_or("malformed domain reason")
        } else {
            short_reason(*word)
        },
        None => "empty domain panic",
    };
    Rejection { status_class: 'GAMEPLAY_REJECTED', reason }
}

#[derive(Drop, starknet::Event)]
pub struct GameplayRejected {
    #[key]
    pub version: u8,
    #[key]
    pub game_id: u32,
    #[key]
    pub actor: ContractAddress,
    #[key]
    pub tx_hash: felt252,
    pub status_class: felt252,
    pub reason: ByteArray,
}

pub fn validated_command(
    arguments: Span<felt252>,
) -> Result<(u32, crate::command_routes::CommandRoute, Span<felt252>), felt252> {
    let route = route_command(arguments)?;
    let mut fields = arguments;
    let _command: Command = Serde::deserialize(ref fields).ok_or('INVALID_COMMAND')?;
    if !fields.is_empty() {
        return Err('INVALID_COMMAND');
    }
    Ok(route)
}

#[starknet::interface]
pub trait ICommandPreparation<T> {
    fn prepare_homes(ref self: T, game_id: u32, owners: Span<ContractAddress>);
    fn validate_command(self: @T, command: Span<felt252>) -> u32;
    fn assign_open_home(ref self: T, game_id: u32, actor: ContractAddress);
}
