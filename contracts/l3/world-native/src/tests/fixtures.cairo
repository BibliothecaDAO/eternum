use starknet::ContractAddress;
use crate::troops::{ExplorerKey, Troops};

#[starknet::interface]
pub trait IFixture<T> {
    fn destroy(ref self: T, key: ExplorerKey);
    fn update_troops(ref self: T, key: ExplorerKey, troops: Troops);
    fn received_actor(self: @T) -> ContractAddress;
    fn received_root(self: @T) -> u256;
    fn received_timestamp(self: @T) -> u64;
}

#[starknet::contract]
pub mod TroopFixture {
    use starknet::ContractAddress;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use crate::commands::{CreateExplorer, Explore};
    use crate::logic::troops::TroopState;
    use crate::troops::{Coord, ExplorerKey, ExplorerRecord, Stamina, TroopTier, TroopType, Troops};

    #[storage]
    struct Storage {
        actor: ContractAddress,
        root: u256,
        timestamp: u64,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        TroopEvent: TroopState::Event,
    }
    #[abi(embed_v0)]
    impl Fixture of super::IFixture<ContractState> {
        fn destroy(ref self: ContractState, key: ExplorerKey) {
            let coord = crate::logic::map::entity_coord(
                crate::resources::ResourceKey { game_id: key.game_id, entity_id: key.explorer_id },
            )
                .unwrap();
            crate::logic::map::MapState::vacate(crate::geometry::tile_key(key.game_id, coord), key.explorer_id);
            crate::logic::troops::TroopState::destroy(key);
        }
        fn update_troops(ref self: ContractState, key: ExplorerKey, troops: Troops) {
            crate::logic::troops::TroopState::update_troops(key, troops);
        }
        fn received_actor(self: @ContractState) -> ContractAddress {
            self.actor.read()
        }
        fn received_timestamp(self: @ContractState) -> u64 {
            self.timestamp.read()
        }
        fn received_root(self: @ContractState) -> u256 {
            self.root.read()
        }
    }
    #[abi(embed_v0)]
    impl Commands of crate::commands::ICreateExplorer<ContractState> {
        fn create_explorer(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: CreateExplorer,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            self.actor.write(actor);
            self.root.write(context.raw_root);
            self.timestamp.write(context.timestamp);
            let home = crate::resources::ResourceKey { game_id, entity_id: command.structure_id };
            if !crate::logic::structures::exists(home) {
                crate::logic::structures::StructureState::create(
                    home,
                    crate::structures::StructureRecord {
                        owner: actor,
                        base: crate::structures::StructureBase {
                            category: 1, troop_max_explorer_count: 1, ..Default::default(),
                        },
                        resources_packed: 0,
                        metadata: Default::default(),
                    },
                );
            }
            crate::logic::map::MapState::occupy(
                crate::geometry::tile_key(game_id, Coord { alt: false, x: command.structure_id + 5, y: 34 }),
                command.structure_id,
                15,
                false,
            );
            crate::logic::troops::TroopState::create(
                ExplorerKey { game_id, explorer_id: command.structure_id },
                ExplorerRecord {
                    owner: command.structure_id,
                    troops: Troops {
                        category: TroopType::Knight,
                        tier: TroopTier::T1,
                        count: command.amount,
                        stamina: Stamina { amount: 0, updated_tick: 0 },
                        boosts: Default::default(),
                        battle_cooldown_end: 0,
                    },
                },
            );
            assert!(context.raw_root != 0, "fixture late rejection");

            ((), story_cursor)
        }
    }
    #[abi(embed_v0)]
    impl Exploration of crate::commands::IExplore<ContractState> {
        fn explore(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: Explore,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            panic!("fixture unsupported command");
        }
    }
}

/// The SNIP-6 check of the shard's account class: one device key per fixture, signatures `[device_key, r, s]`.
#[starknet::interface]
pub trait IDeviceSignature<T> {
    fn is_valid_signature(self: @T, hash: felt252, signature: Array<felt252>) -> felt252;
}

pub fn device_signature_result(key: felt252, hash: felt252, signature: Span<felt252>) -> felt252 {
    if signature.len() == 3
        && *signature[0] == key
        && core::ecdsa::check_ecdsa_signature(hash, key, *signature[1], *signature[2]) {
        starknet::VALIDATED
    } else {
        0
    }
}

#[starknet::interface]
pub trait IAccountUpgrade<T> {
    fn upgrade(ref self: T, class_hash: starknet::ClassHash);
}

#[starknet::contract]
pub mod AccountFixture {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    #[storage]
    struct Storage {
        key: felt252,
        realms_id: felt252,
    }
    #[constructor]
    fn constructor(ref self: ContractState, realms_id: felt252, guardian_public_key: felt252) {
        assert!(guardian_public_key != 0, "zero guardian");
        self.realms_id.write(realms_id);
        self.key.write(0x399ab58e2d17603eeccae95933c81d504ce475eb1bd0080d2316b84232e133c);
    }
    #[external(v0)]
    fn realms_id(self: @ContractState) -> felt252 {
        self.realms_id.read()
    }
    #[abi(embed_v0)]
    impl Signature of super::IDeviceSignature<ContractState> {
        fn is_valid_signature(self: @ContractState, hash: felt252, signature: Array<felt252>) -> felt252 {
            super::device_signature_result(self.key.read(), hash, signature.span())
        }
    }
    #[abi(embed_v0)]
    impl Upgrade of super::IAccountUpgrade<ContractState> {
        fn upgrade(ref self: ContractState, class_hash: starknet::ClassHash) {
            starknet::syscalls::replace_class_syscall(class_hash).unwrap();
        }
    }
}


#[starknet::interface]
pub trait IRollbackFixture<T> {
    fn attempt_preset(
        ref self: T, registry: ContractAddress, preset_id: u32, definition: crate::presets::PresetDefinition,
    ) -> bool;
    fn attempt(
        ref self: T,
        season: ContractAddress,
        intent: eternum_randomness_protocol::Intent,
        context: eternum_randomness_protocol::entrypoint::ExecutionContext,
        signature: Span<felt252>,
    ) -> bool;
}
#[starknet::contract]
pub mod RollbackFixture {
    use eternum_randomness_protocol::Intent;
    use eternum_randomness_protocol::entrypoint::{
        ExecutionContext, IRecordedExecutionSafeDispatcher, IRecordedExecutionSafeDispatcherTrait,
    };
    use starknet::ContractAddress;
    #[storage]
    struct Storage {}
    #[abi(embed_v0)]
    impl Rollback of super::IRollbackFixture<ContractState> {
        #[feature("safe_dispatcher")]
        fn attempt_preset(
            ref self: ContractState,
            registry: ContractAddress,
            preset_id: u32,
            definition: crate::presets::PresetDefinition,
        ) -> bool {
            crate::registrar::IRegistrarSafeDispatcherTrait::register_preset(
                crate::registrar::IRegistrarSafeDispatcher { contract_address: registry }, preset_id, definition,
            )
                .is_ok()
        }

        #[feature("safe_dispatcher")]
        fn attempt(
            ref self: ContractState,
            season: ContractAddress,
            intent: Intent,
            context: ExecutionContext,
            signature: Span<felt252>,
        ) -> bool {
            IRecordedExecutionSafeDispatcher { contract_address: season }.execute(intent, context, signature).is_ok()
        }
    }
}

#[starknet::contract]
pub mod AccountUpgradeFixture {
    use starknet::storage::StoragePointerReadAccess;
    #[storage]
    struct Storage {
        key: felt252,
    }
    #[abi(embed_v0)]
    impl Signature of super::IDeviceSignature<ContractState> {
        fn is_valid_signature(self: @ContractState, hash: felt252, signature: Array<felt252>) -> felt252 {
            super::device_signature_result(self.key.read(), hash, signature.span())
        }
    }
}

#[starknet::interface]
pub trait ITokenFixture<T> {
    fn seed(ref self: T, account: ContractAddress, amount: u256);
    fn set_failure(ref self: T, fail: bool);
    fn set_transfer_fee(ref self: T, fee: u256);
    fn transfer_from(ref self: T, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool;
}
#[starknet::contract]
pub mod BankTokenFixture {
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address};
    #[storage]
    struct Storage {
        balances: Map<ContractAddress, u256>,
        minter: ContractAddress,
        failing: bool,
        transfer_fee: u256,
    }
    #[constructor]
    fn constructor(ref self: ContractState, minter: ContractAddress) {
        self.minter.write(minter);
    }
    #[abi(embed_v0)]
    impl Fixture of super::ITokenFixture<ContractState> {
        fn seed(ref self: ContractState, account: ContractAddress, amount: u256) {
            self.balances.write(account, amount);
        }
        fn set_failure(ref self: ContractState, fail: bool) {
            self.failing.write(fail);
        }
        fn set_transfer_fee(ref self: ContractState, fee: u256) {
            self.transfer_fee.write(fee);
        }
        fn transfer_from(
            ref self: ContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256,
        ) -> bool {
            assert!(get_caller_address() == self.minter.read(), "token spender not approved");
            self.transfer_balance(sender, recipient, amount)
        }
    }
    #[abi(embed_v0)]
    impl Token of crate::withdrawals::IResourceToken<ContractState> {
        fn decimals(self: @ContractState) -> u8 {
            18
        }
        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.read(account)
        }
        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            self.transfer_balance(get_caller_address(), recipient, amount)
        }

        fn mint(ref self: ContractState, recipient: ContractAddress, amount: u256) {
            assert!(get_caller_address() == self.minter.read() && !self.failing.read(), "token mint rejected");
            self.balances.write(recipient, self.balances.read(recipient) + amount);
        }
    }
    #[generate_trait]
    impl Internal of InternalTrait {
        fn transfer_balance(
            ref self: ContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256,
        ) -> bool {
            let balance = self.balances.read(sender);
            let fee = self.transfer_fee.read();
            if self.failing.read() || balance < amount || amount < fee {
                return false;
            }
            self.balances.write(sender, balance - amount);
            self.balances.write(recipient, self.balances.read(recipient) + amount - fee);
            true
        }
    }
}
