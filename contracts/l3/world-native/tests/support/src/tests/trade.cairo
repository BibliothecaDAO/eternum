pub use snforge_std::{
    EventSpyTrait, EventsFilterTrait, spy_events, start_cheat_block_timestamp_global, start_cheat_caller_address,
    stop_cheat_caller_address,
};
pub use crate::commands::Command;
pub use crate::game::IGameDispatcherTrait;
pub use crate::registrar::IRegistrarSafeDispatcherTrait;
pub use crate::resources::{IResourceOperationsDispatcher, ResourceAmount, ResourceKey, ResourceSlot};
pub use crate::rules::RESOURCE_PRECISION;
pub use crate::tests::state::ResourceObservationTrait;
pub use crate::trade::{
    AcceptOrder, CreateOrder, ITradeDispatcher, ITradeDispatcherTrait, ITradeSafeDispatcher, ITradeSafeDispatcherTrait,
    TradeKey, TradeRules,
};
pub use super::resource_commands::{assert_terminal_rejection, execute, grant, setup_with_rules};
pub fn setup() -> (super::Deployment, ResourceKey, ResourceKey) {
    let mut rules = super::play_fixture::rules();
    rules.mode_rules = super::play_fixture::ETERNUM_RULES;
    rules.command_mask = super::play_fixture::ETERNUM_COMMAND_MASK;
    rules.entry_rule = crate::rules::ENTRY_ENTITLEMENT;
    rules.speed_config.donkey_sec_per_km = 1;
    rules.speed_config.donkey_sec_per_km_troops = 2;
    rules.tick_config.delivery_tick_in_seconds = 1;
    rules.capacity_config.donkey_capacity = 10;
    let mut preset = super::resource_commands::fixture_preset(rules);
    preset.economy.trade = TradeRules { max_count: 2 };
    let (deployment, maker, taker) = super::resource_commands::setup_with_preset(preset);
    for key in array![maker, taker] {
        grant(deployment, key, 2, 1000);
        grant(deployment, key, 3, 1000);
        grant(deployment, key, 25, 10 * RESOURCE_PRECISION);
    }
    (deployment, maker, taker)
}
pub fn offer(maker: ResourceKey) -> CreateOrder {
    CreateOrder {
        maker_id: maker.entity_id,
        taker_id: 0,
        offered_resource: 2,
        requested_resource: 3,
        offered_per_lot: 10,
        requested_per_lot: 20,
        lots: 3,
        expires_at: 180,
    }
}
pub fn balance(deployment: super::Deployment, key: ResourceKey, resource_type: u8) -> u128 {
    IResourceOperationsDispatcher { contract_address: deployment.games }
        .resource_balance(ResourceSlot { game_id: key.game_id, entity_id: key.entity_id, resource_type })
}
pub fn create(deployment: super::Deployment, command: CreateOrder) -> TradeKey {
    create_at(deployment, command, 40)
}
pub fn create_at(deployment: super::Deployment, command: CreateOrder, timestamp: u64) -> TradeKey {
    let mut spy = snforge_std::spy_events();
    assert!(execute(deployment, Command::CreateTradeOrder(command), timestamp));
    for (_, event) in spy.get_events().emitted_by(deployment.games).events.span() {
        if *event.keys.at(0) == selector!("StoryEvent") {
            let mut keys = event.keys.span().slice(1, event.keys.len() - 1);
            let mut data = event.data.span();
            let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref keys, ref data).unwrap();
            if let crate::ownership::Story::TradeCreated(listing) = story.story {
                return TradeKey { game_id: 3, trade_id: listing.trade_id };
            }
        }
    }
    panic!("missing trade creation story")
}
pub fn accept(key: TradeKey, taker: ResourceKey, lots: u64) -> Command {
    Command::AcceptTradeOrder(AcceptOrder { trade_id: key.trade_id, taker_id: taker.entity_id, lots })
}
pub fn arrival(deployment: super::Deployment, key: ResourceKey, at: u64, duration: u64) -> Span<ResourceAmount> {
    IResourceOperationsDispatcher { contract_address: deployment.games }
        .resource_arrival(crate::arrivals::arrival_key(3, key.entity_id, 1, at, duration))
        .resources
}
pub fn change_structure(deployment: super::Deployment, key: ResourceKey, category: u8, alt: bool) {
    let view = crate::structures::IStructureOperationsDispatcher { contract_address: deployment.games };
    let structure = crate::tests::state::StructureObservationTrait::structure(view, key).unwrap();
    let coord = crate::tests::state::StructureObservationTrait::position(view, key).unwrap();
    snforge_std::interact_with_state(
        deployment.games,
        || crate::logic::map::MapState::relocate_fixture(key, crate::troops::Coord { alt, ..coord }, category, true),
    );
    super::resource_commands::set_fixture(
        deployment.games,
        selector!("structures"),
        selector!("structures"),
        array![3, key.entity_id.into()].span(),
        crate::structures::StructureRecord {
            owner: structure.owner,
            base: crate::structures::StructureBase { category, ..structure.base },
            resources_packed: structure.resources_packed,
            metadata: structure.metadata,
        },
    );
}
