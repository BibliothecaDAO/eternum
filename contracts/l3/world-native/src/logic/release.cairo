pub use games_storage::release::Release;
use starknet::storage::StoragePointerReadAccess;

#[starknet::interface]
pub trait IReleases<T> {
    fn register_release(ref self: T, release_id: u32, release: Release);
    fn apply_release(ref self: T, game_id: u32, release_id: u32);
    fn current_release(self: @T) -> u32;
    fn game_release(self: @T, game_id: u32) -> u32;
    fn release(self: @T, release_id: u32) -> Release;
}

#[starknet::interface]
pub trait IReleaseMigration<T> {
    fn migrate(ref self: T, game_id: u32, previous_release: u32, release_id: u32);
}

pub fn assert_authority() {
    assert!(starknet::get_caller_address() == crate::state::read().authority.read(), "only domain authority");
}

#[starknet::component]
pub mod ReleaseState {
    use core::num::traits::Zero;
    use games_storage::release::LogicClasses;
    use starknet::ContractAddress;
    use starknet::storage::{
        StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use super::{IReleaseMigrationDispatcherTrait, IReleaseMigrationLibraryDispatcher, Release};

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    pub struct Storage {
        #[flat]
        pub data: crate::state::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {}

    #[embeddable_as(ReleasesImpl)]
    pub impl Releases<
        TContractState, +HasComponent<TContractState>, +Drop<TContractState>,
    > of super::IReleases<ComponentState<TContractState>> {
        fn register_release(ref self: ComponentState<TContractState>, release_id: u32, release: Release) {
            self.assert_authority();
            let current = self.current_release();
            if release_id != 0 && release_id <= current {
                assert!(self.release(release_id) == release, "release is immutable");
                return;
            }
            assert!(release_id == current + 1, "release must be next");
            games_storage::release::validate(release.classes);
            self.data.releases.write(release_id, release);
            self.data.current_release.write(release_id);
        }

        fn apply_release(ref self: ComponentState<TContractState>, game_id: u32, release_id: u32) {
            let game = crate::logic::game::game(game_id);
            assert!(starknet::get_caller_address() == game.creator, "only game creator");
            let target = self.release(release_id);
            let previous_release = self.game_release(game_id);
            if release_id == previous_release {
                return;
            }
            assert!(release_id == previous_release + 1, "release must follow game pin");
            // A failed migration reverts the pin and every data write in the same transaction.
            self.data.game_releases.write(game_id, release_id);
            crate::logic::game::emit_release(game_id, release_id, crate::logic::game::preset_commitment(game_id));
            if target.migration.is_non_zero() {
                IReleaseMigrationLibraryDispatcher { class_hash: target.migration }
                    .migrate(game_id, previous_release, release_id);
            }
        }

        fn current_release(self: @ComponentState<TContractState>) -> u32 {
            self.data.current_release.read()
        }

        fn game_release(self: @ComponentState<TContractState>, game_id: u32) -> u32 {
            let release_id = self.data.game_releases.read(game_id);
            assert!(release_id != 0, "game has no release");
            release_id
        }

        fn release(self: @ComponentState<TContractState>, release_id: u32) -> Release {
            let release = self.data.releases.read(release_id);
            assert!(release_id != 0 && release.classes.season.is_non_zero(), "unknown release");
            release
        }
    }

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
            self.data.releases.read(release_id).classes
        }

        fn classes(
            self: @ComponentState<TContractState>, game_id: u32,
        ) -> starknet::storage::StoragePointer<LogicClasses> {
            let release_id = self.data.game_releases.read(game_id);
            assert!(release_id != 0, "game has no release");
            self.data.releases.entry(release_id).classes
        }
    }
}
