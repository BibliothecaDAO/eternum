use core::array::{ArrayTrait, SpanTrait};
use dojo::utils::test::spawn_test_world;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::models::bank::bank::bank;
use eternum::models::bank::liquidity::liquidity;
use eternum::models::bank::market::market;
use eternum::models::buildings::building_quantityv_2;
use eternum::models::buildings::{building, Building};
use eternum::models::capacity::{capacity_category, CapacityCategory};
use eternum::models::combat::army;
use eternum::models::combat::battle;
use eternum::models::combat::health;
use eternum::models::combat::protectee;
use eternum::models::combat::protector;
use eternum::models::config::{
    world_config, speed_config, capacity_config, weight_config, hyperstructure_resource_config, stamina_config,
    stamina_refill_config, tick_config, map_config, realm_free_mint_config, mercenaries_config, leveling_config,
    production_config, bank_config, building_config, troop_config, battle_config, building_category_pop_config,
    population_config, has_claimed_starting_resources, hyperstructure_config, travel_stamina_cost_config,
    realm_level_config, realm_max_level_config, travel_food_cost_config, settlement_config
};
use eternum::models::guild::{guild, guild_member, guild_whitelist};
use eternum::models::hyperstructure::{
    Progress, progress, Contribution, contribution, Hyperstructure, hyperstructure, Epoch, epoch, Season, season
};
use eternum::models::map::tile;
use eternum::models::metadata::{entity_metadata, EntityMetadata};
use eternum::models::metadata::{foreign_key, ForeignKey};
use eternum::models::movable::{movable, Movable, arrival_time, ArrivalTime};
use eternum::models::name::{address_name, AddressName};
use eternum::models::name::{entity_name, EntityName};
use eternum::models::order::orders;
use eternum::models::owner::entity_owner;
use eternum::models::owner::{owner, Owner};
use eternum::models::population::population;
use eternum::models::position::{position};
use eternum::models::production::{production, production_input, production_output, production_deadline};
use eternum::models::quantity::{quantity, Quantity, quantity_tracker, QuantityTracker};
use eternum::models::realm::{realm, Realm};
use eternum::models::resources::detached_resource;
use eternum::models::resources::owned_resources_tracker;
use eternum::models::resources::resource_allowance;
use eternum::models::resources::resource_transfer_lock;
use eternum::models::resources::{resource, Resource};
use eternum::models::resources::{resource_cost, ResourceCost};
use eternum::models::stamina::stamina;
use eternum::models::structure::structure;
use eternum::models::structure::structure_count;
use eternum::models::trade::{status, Status, trade, Trade,};
use eternum::models::weight::weight;

use starknet::contract_address_const;

// used to spawn a test world with all the models and systems registered
fn spawn_eternum() -> IWorldDispatcher {
    let mut models = array![
        weight::TEST_CLASS_HASH,
        building::TEST_CLASS_HASH,
        health::TEST_CLASS_HASH,
        army::TEST_CLASS_HASH,
        protector::TEST_CLASS_HASH,
        protectee::TEST_CLASS_HASH,
        battle::TEST_CLASS_HASH,
        guild::TEST_CLASS_HASH,
        building_quantityv_2::TEST_CLASS_HASH,
        tile::TEST_CLASS_HASH,
        orders::TEST_CLASS_HASH,
        entity_owner::TEST_CLASS_HASH,
        population::TEST_CLASS_HASH,
        production::TEST_CLASS_HASH,
        production_input::TEST_CLASS_HASH,
        production_output::TEST_CLASS_HASH,
        resource_allowance::TEST_CLASS_HASH,
        detached_resource::TEST_CLASS_HASH,
        owned_resources_tracker::TEST_CLASS_HASH,
        resource_transfer_lock::TEST_CLASS_HASH,
        stamina::TEST_CLASS_HASH,
        structure::TEST_CLASS_HASH,
        structure_count::TEST_CLASS_HASH,
        bank::TEST_CLASS_HASH,
        liquidity::TEST_CLASS_HASH,
        market::TEST_CLASS_HASH,
        guild_member::TEST_CLASS_HASH,
        guild_whitelist::TEST_CLASS_HASH,
        map_config::TEST_CLASS_HASH,
        realm_free_mint_config::TEST_CLASS_HASH,
        mercenaries_config::TEST_CLASS_HASH,
        settlement_config::TEST_CLASS_HASH,
        leveling_config::TEST_CLASS_HASH,
        production_config::TEST_CLASS_HASH,
        bank_config::TEST_CLASS_HASH,
        building_config::TEST_CLASS_HASH,
        troop_config::TEST_CLASS_HASH,
        battle_config::TEST_CLASS_HASH,
        building_category_pop_config::TEST_CLASS_HASH,
        population_config::TEST_CLASS_HASH,
        has_claimed_starting_resources::TEST_CLASS_HASH,
        owner::TEST_CLASS_HASH,
        movable::TEST_CLASS_HASH,
        quantity::TEST_CLASS_HASH,
        realm::TEST_CLASS_HASH,
        speed_config::TEST_CLASS_HASH,
        capacity_config::TEST_CLASS_HASH,
        world_config::TEST_CLASS_HASH,
        entity_metadata::TEST_CLASS_HASH,
        quantity_tracker::TEST_CLASS_HASH,
        position::TEST_CLASS_HASH,
        arrival_time::TEST_CLASS_HASH,
        foreign_key::TEST_CLASS_HASH,
        trade::TEST_CLASS_HASH,
        resource::TEST_CLASS_HASH,
        resource_cost::TEST_CLASS_HASH,
        status::TEST_CLASS_HASH,
        weight_config::TEST_CLASS_HASH,
        progress::TEST_CLASS_HASH,
        contribution::TEST_CLASS_HASH,
        hyperstructure_resource_config::TEST_CLASS_HASH,
        hyperstructure_config::TEST_CLASS_HASH,
        epoch::TEST_CLASS_HASH,
        hyperstructure::TEST_CLASS_HASH,
        season::TEST_CLASS_HASH,
        stamina_config::TEST_CLASS_HASH,
        stamina_refill_config::TEST_CLASS_HASH,
        tick_config::TEST_CLASS_HASH,
        address_name::TEST_CLASS_HASH,
        entity_name::TEST_CLASS_HASH,
        capacity_category::TEST_CLASS_HASH,
        production_deadline::TEST_CLASS_HASH,
        travel_stamina_cost_config::TEST_CLASS_HASH,
        realm_level_config::TEST_CLASS_HASH,
        realm_max_level_config::TEST_CLASS_HASH,
        travel_food_cost_config::TEST_CLASS_HASH,
    ];

    let world = spawn_test_world(["eternum"].span(), models.span());

    world.uuid();

    world.grant_owner(dojo::utils::bytearray_hash(@"eternum"), contract_address_const::<'player1'>());
    world.grant_owner(dojo::utils::bytearray_hash(@"eternum"), contract_address_const::<'player2'>());
    world.grant_owner(dojo::utils::bytearray_hash(@"eternum"), contract_address_const::<'player3'>());
    world.grant_owner(dojo::utils::bytearray_hash(@"eternum"), contract_address_const::<'player_1_realm_owner'>());
    world.grant_owner(dojo::utils::bytearray_hash(@"eternum"), contract_address_const::<'player_2_realm_owner'>());
    world.grant_owner(dojo::utils::bytearray_hash(@"eternum"), contract_address_const::<'player_3_realm_owner'>());

    world.grant_owner(dojo::utils::bytearray_hash(@"eternum"), contract_address_const::<'realms_owner'>());
    world.grant_owner(dojo::utils::bytearray_hash(@"eternum"), contract_address_const::<'realm_owner'>());
    world.grant_owner(dojo::utils::bytearray_hash(@"eternum"), contract_address_const::<'caller'>());

    world.grant_owner(dojo::utils::bytearray_hash(@"eternum"), contract_address_const::<'maker'>());
    world.grant_owner(dojo::utils::bytearray_hash(@"eternum"), contract_address_const::<'taker'>());
    world.grant_owner(dojo::utils::bytearray_hash(@"eternum"), contract_address_const::<'0'>());
    world.grant_owner(dojo::utils::bytearray_hash(@"eternum"), contract_address_const::<'takers_other_realm'>());
    world
}
