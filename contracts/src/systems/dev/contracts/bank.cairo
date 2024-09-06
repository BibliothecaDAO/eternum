use dojo::world::IWorldDispatcher;
use eternum::alias::ID;
use eternum::models::position::{Coord};

#[dojo::interface]
trait IBankSystems {
    fn create_admin_bank(ref world: IWorldDispatcher, coord: Coord, owner_fee_num: u128, owner_fee_denom: u128) -> ID;
}

#[dojo::contract]
mod dev_bank_systems {
    use eternum::alias::ID;
    use eternum::constants::{WORLD_CONFIG_ID, ResourceTypes};
    use eternum::models::bank::bank::{Bank};
    use eternum::models::config::{BankConfig};
    use eternum::models::owner::{Owner, EntityOwner};
    use eternum::models::position::{Position, Coord};
    use eternum::models::resources::{Resource, ResourceCustomImpl};
    use eternum::models::structure::{Structure, StructureCategory, StructureCount, StructureCountCustomTrait};
    use eternum::systems::config::contracts::config_systems::{assert_caller_is_admin};
    use eternum::systems::map::contracts::map_systems::InternalMapSystemsImpl;

    use traits::Into;

    const ADMIN_BANK_ACCOUNT_ENTITY_ID: ID = 999999999;
    const ADMIN_BANK_ENTITY_ID: ID = 999999998;

    #[abi(embed_v0)]
    impl BankSystemsImpl of super::IBankSystems<ContractState> {
        fn create_admin_bank(
            ref world: IWorldDispatcher, coord: Coord, owner_fee_num: u128, owner_fee_denom: u128
        ) -> ID {
            // explore the tile
            InternalMapSystemsImpl::explore(world, 0, coord, array![].span());

            assert_caller_is_admin(world);
            let admin = starknet::get_caller_address();

            // bank
            set!(
                world,
                (
                    Structure {
                        entity_id: ADMIN_BANK_ENTITY_ID,
                        category: StructureCategory::Bank,
                        created_at: starknet::get_block_timestamp()
                    },
                    StructureCount { coord, count: 1 },
                    Bank { entity_id: ADMIN_BANK_ENTITY_ID, owner_fee_num, owner_fee_denom, exists: true },
                    Position { entity_id: ADMIN_BANK_ENTITY_ID, x: coord.x, y: coord.y },
                    Owner { entity_id: ADMIN_BANK_ENTITY_ID, address: admin }
                )
            );

            ADMIN_BANK_ENTITY_ID
        }
    }
}
