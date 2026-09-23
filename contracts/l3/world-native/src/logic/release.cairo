use starknet::storage::StoragePointerReadAccess;

pub fn assert_authority() {
    assert!(starknet::get_caller_address() == crate::state::read().authority.read(), "only domain authority");
}

#[starknet::component]
pub mod ReleaseState {
    use games_storage::release::LogicClasses;
    use starknet::ContractAddress;
    use starknet::storage::{StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess};

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    pub struct Storage {
        #[flat]
        pub data: crate::state::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {}

    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn authority(self: @ComponentState<TContractState>) -> ContractAddress {
            self.data.authority.read()
        }

        fn assert_authority(self: @ComponentState<TContractState>) {
            super::assert_authority();
        }

        fn current_classes(self: @ComponentState<TContractState>) -> LogicClasses {
            let release_id = self.data.current_release.read();
            assert!(release_id != 0, "shard has no release");
            self.data.releases.read(release_id)
        }

        fn classes(
            self: @ComponentState<TContractState>, game_id: u32,
        ) -> starknet::storage::StoragePath<LogicClasses> {
            let release_id = self.data.game_releases.read(game_id);
            assert!(release_id != 0, "game has no release");
            self.data.releases.entry(release_id)
        }
    }
}
