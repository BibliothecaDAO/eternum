use core::array::{ArrayTrait, SpanTrait};
use dojo::utils::test::spawn_test_world;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::models::bank::bank::bank;
use eternum::models::bank::liquidity::liquidity;
use eternum::models::bank::market::market;
use eternum::models::buildings::building_quantityv_2;
use eternum::models::buildings::{building, Building};
use eternum::models::capacity::{capacity, Capacity};
use eternum::models::combat::army;
use eternum::models::combat::battle;
use eternum::models::combat::health;
use eternum::models::combat::protectee;
use eternum::models::combat::protector;
use eternum::models::config::{
    world_config, speed_config, capacity_config, weight_config, road_config, hyperstructure_resource_config,
    stamina_config, stamina_refill_config, tick_config, map_explore_config, realm_free_mint_config, mercenaries_config,
    leveling_config, production_config, bank_config, building_config, troop_config, battle_config,
    building_category_pop_config, population_config, has_claimed_starting_resources, hyperstructure_config
};
use eternum::models::guild::{guild, guild_member, guild_whitelist};
use eternum::models::hyperstructure::{
    Progress, progress, Contribution, contribution, HyperstructureUpdate, hyperstructure_update
};
use eternum::models::level::level;
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
use eternum::models::production::{production, production_input, production_output};
use eternum::models::quantity::{quantity, Quantity, quantity_tracker, QuantityTracker};
use eternum::models::realm::{realm, Realm};
use eternum::models::resources::detached_resource;
use eternum::models::resources::owned_resources_tracker;
use eternum::models::resources::resource_allowance;
use eternum::models::resources::resource_transfer_lock;
use eternum::models::resources::{resource, Resource};
use eternum::models::resources::{resource_cost, ResourceCost};
use eternum::models::road::{road, Road};
use eternum::models::stamina::stamina;
use eternum::models::structure::structure;
use eternum::models::structure::structure_count;
use eternum::models::trade::{status, Status, trade, Trade,};
use eternum::models::weight::weight;

use starknet::contract_address_const;

// used to spawn a test world with all the models and systems registered
fn spawn_eternum() -> IWorldDispatcher {

    let world = spawn_test_world!();

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
