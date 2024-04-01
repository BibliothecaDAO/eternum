#[dojo::contract]
mod bank_systems {
    use eternum::models::bank::bank::{BankAccounts, Bank};
    use eternum::systems::bank::interface::bank::IBankSystems;
    use eternum::models::position::Position;

    #[abi(embed_v0)]
    impl BankSystemsImpl of IBankSystems<ContractState> {
        fn open_account(self: @ContractState, world: IWorldDispatcher, bank_entity_id: u128) {
            let player = starknet::get_caller_address();

            // todo:
            // check if the bank exists
            let bank = get!(world, bank_entity_id, Bank);
            assert(bank.owner.into() != 0, 'Bank does not exist');

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

            set!(
                world,
                (Position { entity_id: entity_id.into(), x: bank_position.x, y: bank_position.y })
            );
        }
    }
}
