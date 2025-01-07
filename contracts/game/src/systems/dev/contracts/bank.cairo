use dojo::world::IWorldDispatcher;
use s0_eternum::alias::ID;
use s0_eternum::models::position::{Coord};

#[starknet::interface]
trait IBankSystems<T> {
    fn create_admin_bank(
        ref self: T,
        name: felt252,
        coord: Coord,
        owner_fee_num: u128,
        owner_fee_denom: u128,
        owner_bridge_fee_dpt_percent: u16,
        owner_bridge_fee_wtdr_percent: u16
    ) -> ID;
}

#[dojo::contract]
mod dev_bank_systems {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;

    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use s0_eternum::alias::ID;
    use s0_eternum::constants::DEFAULT_NS;
    use s0_eternum::constants::{WORLD_CONFIG_ID, ResourceTypes};
    use s0_eternum::models::bank::bank::{Bank};
    use s0_eternum::models::capacity::{CapacityCategory};
    use s0_eternum::models::config::{BankConfig, CapacityConfigCategory, MercenariesConfig};
    use s0_eternum::models::name::{EntityName};
    use s0_eternum::models::owner::{Owner, EntityOwner};
    use s0_eternum::models::position::{Position, Coord};
    use s0_eternum::models::resources::{Resource, ResourceImpl};
    use s0_eternum::models::structure::{Structure, StructureCategory, StructureCount, StructureCountTrait};
    use s0_eternum::systems::config::contracts::config_systems::{assert_caller_is_admin};
    use s0_eternum::systems::map::contracts::map_systems::InternalMapSystemsImpl;
    use s0_eternum::systems::map::map_generation::{
        IMapGenerationSystemsDispatcher, IMapGenerationSystemsDispatcherTrait
    };
    use traits::Into;

    const ADMIN_BANK_ACCOUNT_ENTITY_ID: ID = 999999999;
    const ADMIN_BANK_ENTITY_ID: ID = 999999998;

    #[abi(embed_v0)]
    impl BankSystemsImpl of super::IBankSystems<ContractState> {
        fn create_admin_bank(
            ref self: ContractState,
            name: felt252,
            coord: Coord,
            owner_fee_num: u128,
            owner_fee_denom: u128,
            owner_bridge_fee_dpt_percent: u16,
            owner_bridge_fee_wtdr_percent: u16
        ) -> ID {
            // explore the tile
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            InternalMapSystemsImpl::explore(ref world, 0, coord, array![].span());

            assert_caller_is_admin(world);
            let admin = starknet::get_caller_address();

            // bank
            world.write_model(@EntityName { entity_id: ADMIN_BANK_ENTITY_ID, name, },);
            world
                .write_model(
                    @Structure {
                        entity_id: ADMIN_BANK_ENTITY_ID,
                        category: StructureCategory::Bank,
                        created_at: starknet::get_block_timestamp()
                    }
                );
            world.write_model(@StructureCount { coord, count: 1 });
            world
                .write_model(
                    @CapacityCategory { entity_id: ADMIN_BANK_ENTITY_ID, category: CapacityConfigCategory::Structure }
                );
            world
                .write_model(
                    @Bank {
                        entity_id: ADMIN_BANK_ENTITY_ID,
                        owner_fee_num,
                        owner_fee_denom,
                        owner_bridge_fee_dpt_percent,
                        owner_bridge_fee_wtdr_percent,
                        exists: true
                    },
                );
            world.write_model(@Position { entity_id: ADMIN_BANK_ENTITY_ID, x: coord.x, y: coord.y },);
            world.write_model(@Owner { entity_id: ADMIN_BANK_ENTITY_ID, address: admin },);
            world.write_model(@EntityOwner { entity_id: ADMIN_BANK_ENTITY_ID, entity_owner_id: ADMIN_BANK_ENTITY_ID },);

            let (contract_address, _) = world.dns(@"map_generation_systems").unwrap();
            let map_generation_contract = IMapGenerationSystemsDispatcher { contract_address };

            let seed = 'I AM SEED FOR THE DEV BANK'.into() - starknet::get_block_timestamp().into();

            map_generation_contract.add_mercenaries_to_structure(seed, ADMIN_BANK_ENTITY_ID);

            ADMIN_BANK_ENTITY_ID
        }
    }
}
