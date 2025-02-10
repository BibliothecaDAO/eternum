use dojo::world::IWorldDispatcher;
use s1_eternum::alias::ID;
use s1_eternum::models::position::{Coord};

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
    use s1_eternum::alias::ID;
    use s1_eternum::constants::DEFAULT_NS;
    use s1_eternum::constants::{WORLD_CONFIG_ID, ResourceTypes};
    use s1_eternum::models::bank::bank::{Bank};
    use s1_eternum::models::capacity::{CapacityCategory};
    use s1_eternum::models::config::{BankConfig, CapacityConfigCategory, MercenariesConfig};
    use s1_eternum::models::name::{EntityName};
    use s1_eternum::models::owner::{Owner, EntityOwner};
    use s1_eternum::models::position::{Position, Coord, Occupier, OccupiedBy};
    use s1_eternum::models::resource::resource::{Resource, ResourceImpl};
    use s1_eternum::models::structure::{Structure, StructureImpl, StructureCategory};
    use s1_eternum::systems::config::contracts::config_systems::{assert_caller_is_admin};

    use s1_eternum::systems::utils::troop::iMercenariesImpl;
    use s1_eternum::systems::utils::map::iMapImpl;
    use s1_eternum::utils::map::biomes::{Biome, get_biome};
    use s1_eternum::models::map::Tile;
    use s1_eternum::models::config::CombatConfig;
    use s1_eternum::models::troop::{GuardSlot, TroopTier, TroopType};
    use s1_eternum::models::config::TickImpl;

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
            let mut tile: Tile = world.read_model((coord.x, coord.y));
            assert!(tile.explored_at.is_zero(), "tile already explored");

            let biome = get_biome(coord.x.into(), coord.y.into());
            iMapImpl::explore(ref world, ref tile, biome);

            assert_caller_is_admin(world);
            let admin = starknet::get_caller_address();

            // bank

            // save bank structure
            let owner: Owner = Owner { entity_id: ADMIN_BANK_ENTITY_ID, address: admin };
            let structure: Structure = StructureImpl::new(ADMIN_BANK_ENTITY_ID, StructureCategory::Bank, coord, owner);
            world.write_model(@structure);

            // save occupier
            world.write_model(@Occupier { x: coord.x, y: coord.y, entity: OccupiedBy::Structure(ADMIN_BANK_ENTITY_ID) });

            // save bank name
            world.write_model(@EntityName { entity_id: ADMIN_BANK_ENTITY_ID, name, });

            // save capacity
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


                
            // add guards to structure
            let combat_config: CombatConfig = world.read_model(WORLD_CONFIG_ID);
            let slot_tiers = array![(GuardSlot::Alpha, TroopTier::T3, TroopType::Paladin)].span();
            let tick = TickImpl::retrieve(ref world);
            let seed = 'JUPITERJUPITER'.into() - starknet::get_block_timestamp().into();
            iMercenariesImpl::guard_add(
                ref world, ADMIN_BANK_ENTITY_ID, seed, slot_tiers, combat_config, tick.current());


            ADMIN_BANK_ENTITY_ID
        }
    }
}
