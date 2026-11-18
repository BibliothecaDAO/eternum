use starknet::ContractAddress;
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};

pub fn balance(game_id: u32, account: ContractAddress) -> u128 {
    crate::state::read().entry.fragments.read((game_id, account))
}

pub fn add(game_id: u32, account: ContractAddress, amount: u128) {
    write(game_id, account, balance(game_id, account) + amount);
}

fn write(game_id: u32, account: ContractAddress, value: u128) {
    crate::state::write().entry.fragments.write((game_id, account), value);
    crate::logic::map::MapState::emit(
        crate::logic::map::MapState::Event::RowSet(
            crate::events::RowSet {
                version: 1,
                model: 'Fragments',
                keys: array![game_id.into(), account.into()].span(),
                values: array![value.into()].span(),
            },
        ),
    );
}
