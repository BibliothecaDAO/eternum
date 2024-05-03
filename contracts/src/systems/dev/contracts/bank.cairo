use dojo::world::IWorldDispatcher;
use eternum::alias::ID;
use eternum::models::position::{Coord};

#[dojo::interface]
trait IBankSystems {
    fn create_admin_bank(coord: Coord, owner_fee_scaled: u128) -> (ID, ID);
}

#[dojo::contract]
mod dev_bank_systems {
    use eternum::alias::ID;
    use eternum::constants::{WORLD_CONFIG_ID, ResourceTypes};
    use eternum::models::bank::bank::{BankAccounts, Bank};
    use eternum::models::config::{BankConfig};
    use eternum::models::owner::{Owner, EntityOwner};
    use eternum::models::position::{Position, Coord};
    use eternum::models::resources::{Resource, ResourceImpl};
    use eternum::systems::map::contracts::map_systems::InternalMapSystemsImpl;
    use eternum::systems::config::contracts::config_systems::{assert_caller_is_admin};

    use traits::Into;

    const ADMIN_BANK_ACCOUNT_ENTITY_ID: ID = 999999999999999999_u128;
    const ADMIN_BANK_ENTITY_ID: ID = 999999999999999998_u128;

    #[abi(embed_v0)]
    impl BankSystemsImpl of super::IBankSystems<ContractState> {
        fn create_admin_bank(
            self: @ContractState,
            world: IWorldDispatcher,
            coord: Coord,
            owner_fee_scaled: u128,
        ) -> (ID, ID) {
            // explore the tile
            InternalMapSystemsImpl::explore(
                world, 0_u128, coord, array![].span()
            );

            assert_caller_is_admin(world);
            let admin = starknet::get_caller_address();

            // bank
            set!(
                world,
                (
                    Bank { entity_id: ADMIN_BANK_ENTITY_ID, owner_fee_scaled, exists: true },
                    Position { entity_id: ADMIN_BANK_ENTITY_ID, x: coord.x, y: coord.y },
                    Owner { entity_id: ADMIN_BANK_ENTITY_ID, address: admin }
                )
            );

            // bank account
            set!(
                world,
                (
                    BankAccounts {
                        bank_entity_id: ADMIN_BANK_ENTITY_ID, owner: admin, entity_id: ADMIN_BANK_ACCOUNT_ENTITY_ID
                    },
                    Position {
                        entity_id: ADMIN_BANK_ACCOUNT_ENTITY_ID, x: coord.x, y: coord.y
                    },
                    // todo: let's decide between owner and entity owner
                    Owner { entity_id: ADMIN_BANK_ACCOUNT_ENTITY_ID, address: admin },
                )
            );

            (ADMIN_BANK_ENTITY_ID, ADMIN_BANK_ACCOUNT_ENTITY_ID)
        }
    }
}
