#[dojo::contract]
mod bank_systems {
    use eternum::models::bank::bank::{BankAccounts, Bank};
    use eternum::models::position::{Position, Coord};
    use eternum::models::owner::Owner;
    use eternum::systems::bank::interface::bank::IBankSystems;
    use eternum::alias::ID;

    use traits::Into;

    #[abi(embed_v0)]
    impl BankSystemsImpl of IBankSystems<ContractState> {
        fn create_bank(
            self: @ContractState, world: IWorldDispatcher, coord: Coord, owner_fee_scaled: u128,
        ) -> ID {
            let bank_entity_id: ID = world.uuid().into();

            set!(
                world,
                (
                    Bank { entity_id: bank_entity_id, owner_fee_scaled, exists: true },
                    Position { entity_id: bank_entity_id, x: coord.x, y: coord.y },
                    Owner { entity_id: bank_entity_id, address: starknet::get_caller_address() }
                )
            );
            bank_entity_id
        }

        fn open_account(world: IWorldDispatcher, bank_entity_id: u128) -> ID {
            let player = starknet::get_caller_address();

            // check if the bank exists
            let bank = get!(world, bank_entity_id, Bank);
            assert(bank.exists == true, 'Bank does not exist');

            // get bank position
            let bank_position = get!(world, bank_entity_id, Position);

            // checks if no bank account opened
            let bank_account = get!(world, (bank_entity_id, player), BankAccounts);
            assert(bank_account.entity_id == 0, 'Bank account already opened');

            // creates new entity id
            let entity_id = world.uuid();
            set!(
                world,
                (BankAccounts {
                    bank_entity_id: bank_entity_id, owner: player, entity_id: entity_id.into()
                })
            );
            set!(
                world,
                (Position { entity_id: entity_id.into(), x: bank_position.x, y: bank_position.y })
            );

            entity_id.into()
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
}
