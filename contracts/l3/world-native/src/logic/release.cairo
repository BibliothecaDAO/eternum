pub const RUIN_DEPTH_LIMIT_RELEASE: u32 = 9;
pub const SEAL_RELEASE: u32 = 10;

pub use games_storage::release::Release;
use starknet::ClassHash;
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};

#[starknet::interface]
pub trait IReleases<T> {
    fn register_release(ref self: T, release_id: u32, release: Release, classes: Span<ClassHash>);
    fn open_release(ref self: T, release_id: u32);
    fn apply_release(ref self: T, game_id: u32, release_id: u32);
    fn open_release_of(self: @T, family: u8) -> u32;
    fn latest_release_of(self: @T, family: u8) -> u32;
    fn release_registered(self: @T, release_id: u32) -> bool;
    fn game_release(self: @T, game_id: u32) -> u32;
    fn release(self: @T, release_id: u32) -> Release;
    fn release_classes(self: @T, release_id: u32) -> Span<ClassHash>;
}

#[starknet::interface]
pub trait ISlotViews<T> {
    fn slot_view(self: @T, game_id: u32, calldata: Span<felt252>) -> Span<felt252>;
}

#[starknet::interface]
pub trait ISlotAuthority<T> {
    fn slot_authority(ref self: T, family: u8, calldata: Span<felt252>) -> Span<felt252>;
}

#[starknet::interface]
pub trait IReleaseValidation<T> {
    fn validate_release(self: @T, family: u8, classes: Span<ClassHash>);
}

#[starknet::interface]
pub trait IReleaseMigration<T> {
    fn migrate(ref self: T, game_id: u32, previous_release: u32, release_id: u32);
}

pub fn assert_authority() {
    assert!(starknet::get_caller_address() == crate::state::read().authority.read(), "only domain authority");
}

pub fn assert_launcher() {
    assert!(starknet::get_caller_address() == crate::state::read().launcher.read(), "only launcher");
}

pub fn class_of(game_id: u32, slot: u8) -> ClassHash {
    let release_id = crate::state::read().game_releases.read(game_id);
    assert!(release_id != 0, "game has no release");
    release_class(release_id, slot)
}

pub fn family_class(family: u8, slot: u8) -> ClassHash {
    let release_id = crate::state::read().open_releases.read(family);
    assert!(release_id != 0, "family has no open release");
    release_class(release_id, slot)
}

pub fn release_class(release_id: u32, slot: u8) -> ClassHash {
    crate::state::read().release_classes.read((release_id, slot))
}

pub fn validate_release(family: u8, classes: Span<ClassHash>) {
    assert!(classes.len() >= crate::slots::required_slots(family).into(), "missing logic class");
    for class_hash in classes {
        assert!(core::num::traits::Zero::is_non_zero(class_hash), "missing logic class");
    }
}

pub fn write_release(release_id: u32, release: Release, classes: Span<ClassHash>) {
    assert!(release.slot_count.into() == classes.len(), "slot count is not the class count");
    assert!(classes.len() > crate::slots::REGISTRY.into(), "missing logic class");
    IReleaseValidationLibraryDispatcher { class_hash: *classes[crate::slots::REGISTRY.into()] }
        .validate_release(release.family, classes);
    let state = crate::state::write();
    state.releases.write(release_id, release);
    let mut slot: u8 = 0;
    for class_hash in classes {
        state.release_classes.write((release_id, slot), *class_hash);
        slot += 1;
    }
    state.family_latest.write(release.family, release_id);
}

#[starknet::component]
pub mod ReleaseState {
    use core::num::traits::Zero;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
    use starknet::{ClassHash, ContractAddress};
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
        fn register_release(
            ref self: ComponentState<TContractState>, release_id: u32, release: Release, classes: Span<ClassHash>,
        ) {
            self.assert_authority();
            if self.release_registered(release_id) {
                assert!(
                    self.release(release_id) == release && self.release_classes(release_id) == classes,
                    "release is immutable",
                );
                return;
            }
            assert!(release_id != 0 && self.release_registered(release_id - 1), "release must be next");
            assert!(release.family != 0, "release has no family");
            assert!(release.previous == self.latest_release_of(release.family), "release must follow its family");
            super::write_release(release_id, release, classes);
        }

        fn open_release(ref self: ComponentState<TContractState>, release_id: u32) {
            super::assert_launcher();
            let release = self.release(release_id);
            let current = self.open_release_of(release.family);
            if release_id == current {
                return;
            }
            assert!(release.previous == current, "release must follow the open release");
            self.data.open_releases.write(release.family, release_id);
        }

        fn apply_release(ref self: ComponentState<TContractState>, game_id: u32, release_id: u32) {
            let game = crate::logic::game::game(game_id);
            super::assert_launcher();
            let target = self.release(release_id);
            let previous_release = self.game_release(game_id);
            if release_id == previous_release {
                return;
            }
            assert!(target.family == game.family, "release of another family");
            assert!(target.previous == previous_release, "release must follow game pin");
            assert!(target.slot_count >= self.release(previous_release).slot_count, "release drops a logic class");
            // A failed migration reverts the pin and every data write in the same transaction.
            self.data.game_releases.write(game_id, release_id);
            crate::logic::game::emit_release(game_id, release_id);
            if target.migration.is_non_zero() {
                IReleaseMigrationLibraryDispatcher { class_hash: target.migration }
                    .migrate(game_id, previous_release, release_id);
            }
        }

        fn open_release_of(self: @ComponentState<TContractState>, family: u8) -> u32 {
            self.data.open_releases.read(family)
        }

        fn latest_release_of(self: @ComponentState<TContractState>, family: u8) -> u32 {
            self.data.family_latest.read(family)
        }

        fn release_registered(self: @ComponentState<TContractState>, release_id: u32) -> bool {
            self.data.releases.read(release_id).slot_count != 0
        }

        fn game_release(self: @ComponentState<TContractState>, game_id: u32) -> u32 {
            let release_id = self.data.game_releases.read(game_id);
            assert!(release_id != 0, "game has no release");
            release_id
        }

        fn release(self: @ComponentState<TContractState>, release_id: u32) -> Release {
            assert!(self.release_registered(release_id), "unknown release");
            self.data.releases.read(release_id)
        }

        fn release_classes(self: @ComponentState<TContractState>, release_id: u32) -> Span<ClassHash> {
            let mut classes = array![];
            for slot in 0..self.release(release_id).slot_count {
                classes.append(super::release_class(release_id, slot));
            }
            classes.span()
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
    }
}
