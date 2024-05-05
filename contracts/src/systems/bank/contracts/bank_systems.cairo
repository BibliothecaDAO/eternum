use dojo::world::IWorldDispatcher;
use eternum::alias::ID;
use eternum::models::position::{Coord};

#[dojo::interface]
trait IBankSystems {
    fn create_bank(realm_entity_id: ID, coord: Coord, owner_fee_scaled: u128) -> (ID, ID);
    fn open_account(realm_entity_id: u128, bank_entity_id: u128) -> ID;
    fn change_owner_fee(bank_entity_id: u128, new_swap_fee_unscaled: u128);
}

#[dojo::contract]
mod bank_systems {
    use eternum::alias::ID;
    use eternum::constants::{WORLD_CONFIG_ID, ResourceTypes};
    use eternum::models::bank::bank::{BankAccounts, Bank};
    use eternum::models::config::{BankConfig};
    use eternum::models::owner::{Owner, EntityOwner};
    use eternum::models::position::{Position, Coord};
    use eternum::models::resources::{Resource, ResourceImpl};
    use eternum::models::structure::{Structure, StructureCategory};

    use traits::Into;

    #[abi(embed_v0)]
    impl BankSystemsImpl of super::IBankSystems<ContractState> {
        fn create_bank(
            self: @ContractState,
            world: IWorldDispatcher,
            realm_entity_id: ID,
            coord: Coord,
            owner_fee_scaled: u128,
        ) -> (ID, ID) {
            let bank_entity_id: ID = world.uuid().into();

            //todo: check that tile is explored
            //todo: check that no bank on this position
            //todo: check that no realm on this position

            // remove the resources from the realm
            let bank_config = get!(world, WORLD_CONFIG_ID, BankConfig);

            let mut realm_resource = ResourceImpl::get(
                world, (realm_entity_id, ResourceTypes::LORDS)
            );

            realm_resource.burn(bank_config.lords_cost);
            realm_resource.save(world);

            set!(
                world,
                (
                    Structure { entity_id: bank_entity_id, category: StructureCategory::Bank },
                    Bank { entity_id: bank_entity_id, owner_fee_scaled, exists: true },
                    Position { entity_id: bank_entity_id, x: coord.x, y: coord.y },
                    Owner { entity_id: bank_entity_id, address: starknet::get_caller_address() }
                )
            );

            let bank_account_entity_id = InternalBankSystemsImpl::open_bank_account(
                world, realm_entity_id, bank_entity_id, starknet::get_caller_address()
            );

            (bank_entity_id, bank_account_entity_id)
        }

        fn open_account(world: IWorldDispatcher, realm_entity_id: ID, bank_entity_id: ID) -> ID {
            let player = starknet::get_caller_address();

            // check if the bank exists
            let bank = get!(world, bank_entity_id, Bank);
            assert(bank.exists == true, 'Bank does not exist');

            // checks if no bank account opened
            let bank_account = get!(world, (bank_entity_id, player), BankAccounts);
            assert(bank_account.entity_id == 0, 'Bank account already opened');

            InternalBankSystemsImpl::open_bank_account(
                world, realm_entity_id, bank_entity_id, player
            )
        }

        fn change_owner_fee(
            world: IWorldDispatcher, bank_entity_id: u128, new_swap_fee_unscaled: u128
        ) {
            let player = starknet::get_caller_address();

            let owner = get!(world, bank_entity_id, Owner);
            assert(owner.address == player, 'Only owner can change fee');

            let mut bank = get!(world, bank_entity_id, Bank);
            bank.owner_fee_scaled = new_swap_fee_unscaled;

            set!(world, (bank));
        }
    }

    #[generate_trait]
    impl InternalBankSystemsImpl of InternalBankSystemsTrait {
        fn open_bank_account(
            world: IWorldDispatcher,
            realm_entity_id: u128,
            bank_entity_id: u128,
            player: starknet::ContractAddress
        ) -> ID {
            // get bank position
            let bank_position = get!(world, bank_entity_id, Position);

            // creates new entity id
            let entity_id = world.uuid();
            set!(
                world,
                (
                    BankAccounts {
                        bank_entity_id: bank_entity_id, owner: player, entity_id: entity_id.into()
                    },
                    Position {
                        entity_id: entity_id.into(), x: bank_position.x, y: bank_position.y
                    },
                    // todo: let's decide between owner and entity owner
                    Owner { entity_id: entity_id.into(), address: player },
                    EntityOwner { entity_id: entity_id.into(), entity_owner_id: realm_entity_id }
                )
            );

            entity_id.into()
        }
    }
}
