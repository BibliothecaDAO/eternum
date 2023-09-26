#[system]
mod PurchaseLabor {
    use core::dict::Felt252DictTrait;
    use traits::Into;
    use box::BoxTrait;
    use eternum::systems::labor::utils::{assert_harvestable_resource, get_labor_resource_type};
    use eternum::components::labor::{Labor, LaborTrait};
    use eternum::components::labor_auction::{LaborAuction, LaborAuctionTrait};

    use eternum::alias::ID;
    use eternum::components::owner::Owner;
    use eternum::components::position::{Position, PositionTrait};
    use eternum::components::resources::Resource;

    use eternum::components::config::{LaborConfig, LaborCostResources, LaborCostAmount};
    use starknet::ContractAddress;
    use eternum::constants::{LABOR_CONFIG_ID, ResourceTypes};
    use eternum::utils::unpack::unpack_resource_types;

    use cubit::f128::types::fixed::{Fixed, FixedTrait};

    use dojo::world::Context;

    fn execute(ctx: Context, entity_id: u128, resource_type: u8, labor_units: u128) {
        // assert owner of realm
        let player_id: ContractAddress = ctx.origin;
        let (owner, position) = get!(ctx.world, entity_id, (Owner, Position));
        assert(owner.address == player_id, 'Realm does not belong to player');

        assert_harvestable_resource(resource_type);

        // Get Config
        let labor_config: LaborConfig = get!(ctx.world, LABOR_CONFIG_ID, LaborConfig);

        // pay for labor 
        let labor_cost_resources = get!(ctx.world, resource_type, LaborCostResources);
        let labor_cost_resource_types: Span<u8> = unpack_resource_types(
            labor_cost_resources.resource_types_packed, labor_cost_resources.resource_types_count
        );

        let zone = position.get_zone();
        let mut labor_auction = get!(ctx.world, zone, (LaborAuction));
        assert(labor_auction.per_time_unit != 0, 'Labor auction not found');

        let mut labor_units_remaining = labor_units;
        let mut total_costs: Felt252Dict<u128> = Default::default();

        loop {
            if labor_units_remaining == 0 {
                break;
            }

            let mut index = 0_usize;
            loop {
                if index == labor_cost_resources.resource_types_count.into() {
                    break ();
                }
                let labor_cost_resource_type = *labor_cost_resource_types[index];
                let labor_cost_per_unit = get!(
                    ctx.world, (resource_type, labor_cost_resource_type).into(), LaborCostAmount
                );

                let labor_cost_multiplier = labor_auction.get_price();
                let cost_fixed = FixedTrait::new_unscaled(labor_cost_per_unit.value, false)
                    * labor_cost_multiplier.into();
                let cost: u128 = cost_fixed.try_into().unwrap();

                let total_cost = total_costs.get(labor_cost_resource_type.into());
                total_costs.insert(labor_cost_resource_type.into(), total_cost + cost);
                index += 1;
            };

            labor_auction.sell(ctx.world);
            labor_units_remaining -= 1;
        };

        let mut index = 0_usize;
        loop {
            if index == labor_cost_resources.resource_types_count.into() {
                break ();
            }

            let labor_cost_resource_type = *labor_cost_resource_types[index];
            let total_cost = total_costs.get(labor_cost_resource_type.into());

            let current_resource: Resource = get!(
                ctx.world, (entity_id, labor_cost_resource_type).into(), Resource
            );

            assert(current_resource.balance >= total_cost, 'Not enough resources');
            set!(
                ctx.world,
                Resource {
                    entity_id,
                    resource_type: labor_cost_resource_type,
                    balance: current_resource.balance - total_cost
                }
            );

            index += 1;
        };

        set!(ctx.world, (labor_auction));

        let labor_resource_type: u8 = get_labor_resource_type(resource_type);

        // increment new labor resource in entity balance
        let labor_resource = get!(ctx.world, (entity_id, labor_resource_type), Resource);

        set!(
            ctx.world,
            Resource {
                entity_id,
                resource_type: labor_resource.resource_type,
                balance: labor_resource.balance + labor_units
            }
        );

        return ();
    }
}


#[cfg(test)]
mod tests {
    use eternum::constants::ResourceTypes;
    use eternum::components::resources::Resource;
    use eternum::components::labor::Labor;
    use eternum::components::position::Position;
    use eternum::systems::labor_auction::create_labor_auction::CreateLaborAuction;
    use eternum::components::labor_auction::{LaborAuction, LaborAuctionTrait};

    // testing
    use eternum::utils::testing::spawn_eternum;

    use traits::Into;
    use result::ResultTrait;
    use array::ArrayTrait;
    use option::OptionTrait;
    use serde::Serde;

    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

    const _0_1: u128 = 1844674407370955161; // 0.1

    fn setup(resource_type: u8) -> (IWorldDispatcher, felt252) {
        let world = spawn_eternum();

        let mut create_labor_auction_calldata = array![];
        Serde::serialize(@_0_1, ref create_labor_auction_calldata); // decay
        Serde::serialize(@50, ref create_labor_auction_calldata); // unit per time
        world.execute('CreateLaborAuction', create_labor_auction_calldata);

        // set realm entity
        // x needs to be > 470200 to get zone
        let position = Position { x: 500200, y: 1, entity_id: 1_u128 };
        let mut create_realm_calldata = Default::default();

        Serde::serialize(@1, ref create_realm_calldata); // realm id
        Serde::serialize(@starknet::get_caller_address(), ref create_realm_calldata); // owner
        Serde::serialize(
            @0x20309, ref create_realm_calldata
        ); // resource_types_packed // 2,3,9 // stone, coal, gold
        Serde::serialize(@3, ref create_realm_calldata); // resource_types_count
        Serde::serialize(@5, ref create_realm_calldata); // cities
        Serde::serialize(@5, ref create_realm_calldata); // harbors
        Serde::serialize(@5, ref create_realm_calldata); // rivers
        Serde::serialize(@5, ref create_realm_calldata); // regions
        Serde::serialize(@1, ref create_realm_calldata); // wonder
        Serde::serialize(@1, ref create_realm_calldata); // order
        Serde::serialize(@position, ref create_realm_calldata); // position
        let result = world.execute('CreateRealm', create_realm_calldata);
        let realm_entity_id = *result[0];

        // set labor configuration entity
        let mut create_labor_conf_calldata = array![];

        Serde::serialize(@7200, ref create_labor_conf_calldata); // base_labor_units
        Serde::serialize(@250, ref create_labor_conf_calldata); // base_resources_per_cycle
        Serde::serialize(
            @21_000_000_000_000_000_000, ref create_labor_conf_calldata
        ); // base_food_per_cycle
        world.execute('SetLaborConfig', create_labor_conf_calldata);

        let mut create_labor_cr_calldata = array![];
        Serde::serialize(@resource_type, ref create_labor_cr_calldata); // resource_type_labor
        Serde::serialize(
            @0x203, ref create_labor_cr_calldata
        ); // resource_types_packed // 2,3 // stone and coal
        Serde::serialize(
            @2, ref create_labor_cr_calldata
        ); // resource_types_count // stone and coal
        world.execute('SetLaborCostResources', create_labor_cr_calldata);

        // cost for gold in coal
        let mut create_labor_cv_calldata = array![];
        Serde::serialize(@resource_type, ref create_labor_cv_calldata); // resource_type_labor
        Serde::serialize(@ResourceTypes::COAL, ref create_labor_cv_calldata); // resource_type_cost
        Serde::serialize(@1_000, ref create_labor_cv_calldata); // resource_type_value
        world.execute('SetLaborCostAmount', create_labor_cv_calldata);

        // cost for gold in stone
        let mut create_labor_cv_calldata = array![];
        Serde::serialize(@resource_type, ref create_labor_cv_calldata); // resource_type_labor
        Serde::serialize(@ResourceTypes::STONE, ref create_labor_cv_calldata); // resource_type_cost
        Serde::serialize(@1_000, ref create_labor_cv_calldata); // resource_type_value
        world.execute('SetLaborCostAmount', create_labor_cv_calldata);

        // mint 100_000 coal for the realm;
        let mut mint_coal_calldata = array![];
        Serde::serialize(@realm_entity_id, ref mint_coal_calldata); // realm entity id
        Serde::serialize(@ResourceTypes::COAL, ref mint_coal_calldata); // resource_type
        Serde::serialize(@100_000, ref mint_coal_calldata); // amount
        world.execute('MintResources', mint_coal_calldata);

        // mint 100_000 stone for the realm;
        let mut mint_stone_calldata = array![];
        Serde::serialize(@realm_entity_id, ref mint_stone_calldata); // realm entity id
        Serde::serialize(@ResourceTypes::STONE, ref mint_stone_calldata); // resource_type
        Serde::serialize(@100_000, ref mint_stone_calldata); // amount
        world.execute('MintResources', mint_stone_calldata);

        (world, realm_entity_id)
    }

    #[test]
    #[available_gas(300000000000)]
    fn test_purchase_labor_non_food() {
        let resource_type = ResourceTypes::GOLD;

        let (world, realm_entity_id) = setup(resource_type);

        // purchase labor
        let mut purchase_labor_calldata = array![];
        Serde::serialize(@realm_entity_id, ref purchase_labor_calldata); // realm_id
        Serde::serialize(@resource_type, ref purchase_labor_calldata); // resource_type
        Serde::serialize(@20, ref purchase_labor_calldata); // labor_units
        world.execute('PurchaseLabor', purchase_labor_calldata);

        // assert resources are the right amount
        let coal_resource = get!(world, (realm_entity_id, ResourceTypes::COAL), Resource);
        assert(coal_resource.resource_type == ResourceTypes::COAL, 'failed resource type');
        assert(coal_resource.balance == 79_603, 'failed resource amount');

        let stone_resource = get!(world, (realm_entity_id, ResourceTypes::STONE), Resource);
        assert(stone_resource.resource_type == ResourceTypes::STONE, 'failed resource type');
        assert(stone_resource.balance == 79_603, 'failed resource amount');

        // assert labor resource is right amount
        let gold_labor_resource = get!(world, (realm_entity_id, resource_type + 28), Resource);
        assert(gold_labor_resource.balance == 20, 'wrong labor resource balance');

        let labor_auction = get!(world, 1, LaborAuction);
        assert(labor_auction.sold == 20, 'wrong labor auction sold');
    }

    #[test]
    #[available_gas(300000000000)]
    fn test_purchase_labor_food() {
        let resource_type = ResourceTypes::FISH;
        let (world, realm_entity_id) = setup(resource_type);

        // purchase labor 
        let mut purchase_labor_calldata = array![];
        Serde::serialize(@realm_entity_id, ref purchase_labor_calldata); // realm_id
        Serde::serialize(@resource_type, ref purchase_labor_calldata); // resource_type
        Serde::serialize(@20, ref purchase_labor_calldata); // labor_units
        world.execute('PurchaseLabor', purchase_labor_calldata);

        // assert resources are the right amount
        let coal_resource = get!(world, (realm_entity_id, ResourceTypes::COAL), Resource);
        assert(coal_resource.resource_type == ResourceTypes::COAL, 'failed resource type');
        assert(coal_resource.balance == 79_603, 'failed resource amount');

        let stone_resource = get!(world, (realm_entity_id, ResourceTypes::STONE), Resource);
        assert(stone_resource.resource_type == ResourceTypes::STONE, 'failed resource type');
        assert(stone_resource.balance == 79_603, 'failed resource amount');

        // assert labor resource is right amount
        let fish_labor_resource = get!(world, (realm_entity_id, resource_type - 3), Resource);
        assert(fish_labor_resource.balance == 20, 'wrong labor resource balance');

        let labor_auction = get!(world, 1, LaborAuction);
        assert(labor_auction.sold == 20, 'wrong labor auction sold');
    }
}

