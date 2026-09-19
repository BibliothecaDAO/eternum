use starknet::ContractAddress;
use crate::troops::{ExplorerKey, ExplorerTroops, Troops};

#[starknet::interface]
pub trait IFixture<T> {
    fn explorer(self: @T, key: ExplorerKey) -> Option<ExplorerTroops>;
    fn destroy(ref self: T, key: ExplorerKey);
    fn update_troops(ref self: T, key: ExplorerKey, troops: Troops);
    fn received_actor(self: @T) -> ContractAddress;
    fn received_root(self: @T) -> u256;
    fn received_timestamp(self: @T) -> u64;
}

#[starknet::contract]
pub mod TroopFixture {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_caller_address};
    use crate::commands::{CreateExplorer, ExecutionContext, Explore};
    use crate::lifecycle::Lifecycle;
    use crate::troops::{Coord, ExplorerKey, ExplorerTroops, Stamina, TroopState, TroopTier, TroopType, Troops};
    component!(path: Lifecycle, storage: lifecycle, event: LifecycleEvent);
    component!(path: TroopState, storage: troops, event: TroopEvent);
    #[abi(embed_v0)]
    impl Domain = Lifecycle::DomainImpl<ContractState>;
    impl LifeInternal = Lifecycle::InternalImpl<ContractState>;
    impl TroopInternal = TroopState::InternalImpl<ContractState>;
    #[storage]
    struct Storage {
        #[substorage(v0)]
        lifecycle: Lifecycle::Storage,
        #[substorage(v0)]
        troops: TroopState::Storage,
        actor: ContractAddress,
        root: u256,
        timestamp: u64,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LifecycleEvent: Lifecycle::Event,
        TroopEvent: TroopState::Event,
    }
    #[constructor]
    fn constructor(ref self: ContractState, authority: ContractAddress) {
        self.lifecycle.initialize(authority);
    }
    #[abi(embed_v0)]
    impl Fixture of super::IFixture<ContractState> {
        fn explorer(self: @ContractState, key: ExplorerKey) -> Option<ExplorerTroops> {
            self.troops.explorer(key)
        }
        fn destroy(ref self: ContractState, key: ExplorerKey) {
            self.troops.destroy(key);
        }
        fn update_troops(ref self: ContractState, key: ExplorerKey, troops: Troops) {
            self.troops.update_troops(key, troops);
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
    impl Commands of crate::commands::ITroopCommands<ContractState> {
        fn create_explorer(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: CreateExplorer,
            context: ExecutionContext,
        ) {
            let peers = self.lifecycle.require_active();
            assert!(get_caller_address() == peers.season, "only season domain");
            self.actor.write(actor);
            self.root.write(context.raw_root);
            self.timestamp.write(context.timestamp);
            self
                .troops
                .create(
                    ExplorerKey { game_id, explorer_id: command.structure_id },
                    ExplorerTroops {
                        owner: command.structure_id,
                        troops: Troops {
                            category: TroopType::Knight,
                            tier: TroopTier::T1,
                            count: command.amount,
                            stamina: Stamina { amount: 0, updated_tick: 0 },
                            boosts: Default::default(),
                            battle_cooldown_end: 0,
                        },
                        coord: Coord { alt: false, x: 12, y: 34 },
                    },
                );
            assert!(context.raw_root != 0, "fixture late rejection");
        }
        fn explore(
            ref self: ContractState, game_id: u32, actor: ContractAddress, command: Explore, context: ExecutionContext,
        ) {
            panic!("fixture unsupported command");
        }
        fn battle(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::combat_actions::AttackExplorer,
            context: ExecutionContext,
        ) {
            panic!("fixture unsupported command");
        }
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
    }
    #[constructor]
    fn constructor(ref self: ContractState, key: felt252) {
        self.key.write(key);
    }
    #[abi(embed_v0)]
    impl Key of crate::season::IGameplayKey<ContractState> {
        fn get_public_key(self: @ContractState) -> felt252 {
            self.key.read()
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
pub trait IRegistryFixture<T> {
    fn add_binding(ref self: T, owner: ContractAddress, account: ContractAddress);
}

#[starknet::contract]
pub mod RegistryFixture {
    use starknet::ContractAddress;
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    #[storage]
    struct Storage {
        owners: Map<ContractAddress, ContractAddress>,
        accounts: Map<ContractAddress, ContractAddress>,
    }
    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress, account: ContractAddress) {
        self.owners.write(account, owner);
        self.accounts.write(owner, account);
    }
    #[abi(embed_v0)]
    impl Fixture of super::IRegistryFixture<ContractState> {
        fn add_binding(ref self: ContractState, owner: ContractAddress, account: ContractAddress) {
            self.owners.write(account, owner);
            self.accounts.write(owner, account);
        }
    }
    #[abi(embed_v0)]
    impl Registry of crate::season::IPlayerRegistry<ContractState> {
        fn owner_of(self: @ContractState, account: ContractAddress) -> ContractAddress {
            self.owners.read(account)
        }
        fn account_of(self: @ContractState, owner: ContractAddress) -> ContractAddress {
            self.accounts.read(owner)
        }
    }
}

#[starknet::interface]
pub trait IUpgradeFixture<T> {
    fn revision(self: @T) -> u32;
    fn set_revision(ref self: T, revision: u32);
}

#[starknet::contract]
pub mod MapUpgradeFixture {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use crate::events::RowSet;
    use crate::lifecycle::Lifecycle;
    use crate::map::{MapState, TileKey, TileOpt};
    component!(path: Lifecycle, storage: lifecycle, event: LifecycleEvent);
    component!(path: MapState, storage: map, event: MapEvent);
    #[abi(embed_v0)]
    impl Domain = Lifecycle::DomainImpl<ContractState>;
    impl LifeInternal = Lifecycle::InternalImpl<ContractState>;
    impl MapInternal = MapState::InternalImpl<ContractState>;
    #[storage]
    struct Storage {
        #[substorage(v0)]
        lifecycle: Lifecycle::Storage,
        #[substorage(v0)]
        map: MapState::Storage,
        revision: u32,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LifecycleEvent: Lifecycle::Event,
        MapEvent: MapState::Event,
        RowSet: RowSet,
    }
    #[abi(embed_v0)]
    impl Upgrade of super::IUpgradeFixture<ContractState> {
        fn revision(self: @ContractState) -> u32 {
            self.revision.read()
        }
        fn set_revision(ref self: ContractState, revision: u32) {
            self.lifecycle.assert_authority();
            self.revision.write(revision);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'MapRevision',
                        keys: array![starknet::get_contract_address().into()].span(),
                        values: array![revision.into()].span(),
                    },
                );
        }
    }
    #[abi(embed_v0)]
    impl Map of crate::map::IMap<ContractState> {
        fn biome(self: @ContractState, key: TileKey) -> u8 {
            panic!("storage upgrade fixture")
        }
        fn discovery(
            self: @ContractState, key: TileKey, seed: u256, hyperstructures: u32, timestamp: u64,
        ) -> crate::discovery::Discovery {
            panic!("storage upgrade fixture")
        }
        fn tile(self: @ContractState, key: TileKey) -> Option<TileOpt> {
            self.map.tile(key)
        }
        fn reveal_structure_surroundings(ref self: ContractState, game_id: u32, coord: crate::troops::Coord) {
            panic!("storage upgrade fixture")
        }
        fn reveal(ref self: ContractState, key: TileKey, biome: u8) {
            let peers = self.lifecycle.require_active();
            assert!(starknet::get_caller_address() == peers.troops, "only troops domain");
            self.map.reveal(key, biome);
        }
        fn occupy(ref self: ContractState, key: TileKey, entity_id: u32, category: u8, is_structure: bool) {
            let peers = self.lifecycle.require_active();
            assert!(starknet::get_caller_address() == peers.troops, "only troops domain");
            self.map.occupy(key, entity_id, category, is_structure);
        }
        fn upgrade_realm(ref self: ContractState, key: TileKey, entity_id: u32, wonder: bool, level: u8) {
            assert!(
                starknet::get_caller_address() == self.lifecycle.require_active().structures, "only structures domain",
            );
            self.map.upgrade_realm(key, entity_id, wonder, level);
        }
        fn vacate(ref self: ContractState, key: TileKey, entity_id: u32) {
            let peers = self.lifecycle.require_active();
            assert!(starknet::get_caller_address() == peers.troops, "only troops domain");
            self.map.vacate(key, entity_id);
        }
    }
}

#[starknet::interface]
pub trait IRollbackFixture<T> {
    fn attempt_game(
        ref self: T,
        registry: ContractAddress,
        params: crate::registrar::CreateGameParams,
        definition: crate::presets::PresetDefinition,
    ) -> bool;
    fn attempt(
        ref self: T,
        season: ContractAddress,
        intent: eternum_randomness_protocol::Intent,
        context: eternum_randomness_protocol::entrypoint::ExecutionContext,
        r: felt252,
        s: felt252,
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
        fn attempt_game(
            ref self: ContractState,
            registry: ContractAddress,
            params: crate::registrar::CreateGameParams,
            definition: crate::presets::PresetDefinition,
        ) -> bool {
            crate::registrar::IRegistrarSafeDispatcherTrait::create_game(
                crate::registrar::IRegistrarSafeDispatcher { contract_address: registry }, params, definition,
            )
                .is_ok()
        }

        #[feature("safe_dispatcher")]
        fn attempt(
            ref self: ContractState,
            season: ContractAddress,
            intent: Intent,
            context: ExecutionContext,
            r: felt252,
            s: felt252,
        ) -> bool {
            IRecordedExecutionSafeDispatcher { contract_address: season }.execute(intent, context, r, s).is_ok()
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
    impl Key of crate::season::IGameplayKey<ContractState> {
        fn get_public_key(self: @ContractState) -> felt252 {
            self.key.read()
        }
    }
}

#[starknet::contract]
pub mod RegistryRoundTripFixture {
    use starknet::ContractAddress;
    #[storage]
    struct Storage {}
    #[abi(embed_v0)]
    impl Registry of crate::season::IPlayerRegistry<ContractState> {
        fn owner_of(self: @ContractState, account: ContractAddress) -> ContractAddress {
            0x333.try_into().unwrap()
        }
        fn account_of(self: @ContractState, owner: ContractAddress) -> ContractAddress {
            0x999.try_into().unwrap()
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
