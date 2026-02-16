//! World factory, configured through dojo models.
//!
//! The world factory is a contract that can be used to deploy and manage dojo worlds from the
//! chain.
//! This removes the need of using Sozo for instance and manage the world from a client application
//! directly.
//!
//! Due to the limitation of the transaction resources, the factory is configured through dojo
//! models to support large worlds with multiple transactions.
//! The state is kept internally, so there is no need for external cursors to remember on the client
//! side.

#[dojo::contract]
pub mod factory {
    use core::num::traits::Zero;
    use dojo::model::{Model, ModelStorage};
    use dojo::storage::dojo_store::DojoStore;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use starknet::{ClassHash, ContractAddress, SyscallResultTrait};
    use crate::factory_models::{
        FactoryConfig, FactoryConfigContract, FactoryConfigContractData, FactoryConfigEvent,
        FactoryConfigLibrary, FactoryConfigLibraryData, FactoryConfigModel, FactoryDeploymentCursor,
    };
    use crate::factory_series::FactorySeriesImpl;
    use crate::factory_sync::FactoryConfigSyncImpl;
    use crate::interface::{IWorldFactory, IWorldFactoryMMR, IWorldFactorySeries};
    use crate::mmr_models::MMRRegistration;
    use crate::series_models::{Series, SeriesContract, SeriesContractBySelector, SeriesGame};
    use crate::world_models::WorldDeployed;

    mod errors {
        pub const DEPLOYMENT_ALREADY_COMPLETED: felt252 = 'deployment already completed';
        pub const MAX_ACTIONS_MUST_BE_GT_ZERO: felt252 = 'max actions must be > 0';
        pub const CONFIG_MODIFIED_DURING_DEPLOYMENT: felt252 = 'config changed during deploy';
        pub const NOT_CONFIG_OWNER: felt252 = 'not config owner';
        pub const CONFIG_NOT_INITIALIZED: felt252 = 'config not initialized';
        pub const SERIES_DOES_NOT_EXIST: felt252 = 'series does not exist';
        pub const EXPECTED_NO_OWNER: felt252 = 'no series owner expected';
    }

    #[abi(embed_v0)]
    impl IWorldFactorySeriesImpl of IWorldFactorySeries<ContractState> {
        /// Creates ownership for a new series namespace.
        ///
        /// Can be called only once per series name.
        fn set_series_config(ref self: ContractState, name: felt252) {
            let mut factory_world = self.world_default();

            let mut series: Series = factory_world.read_model(name);
            assert(series.owner.is_zero(), errors::EXPECTED_NO_OWNER);

            series.owner = starknet::get_caller_address();
            factory_world.write_model(@series);
        }

        /// Resolves series identity for a deployed contract address.
        fn get_series_game_data(self: @ContractState, addr: ContractAddress) -> (felt252, u16) {
            let mut factory_world = self.world_default();
            let series_game: SeriesGame = factory_world.read_model(addr);
            return (series_game.name, series_game.game_number);
        }

        /// Resolves contract address by `(series, game_number, selector)`.
        fn get_series_game_address_by_selector(
            self: @ContractState, name: felt252, game_number: u16, selector: felt252,
        ) -> ContractAddress {
            let mut factory_world = self.world_default();
            let series_contract: SeriesContractBySelector = factory_world
                .read_model((name, game_number, selector));
            return series_contract.contract_address;
        }

        /// Resolves contract address by `(series, game_number, class_hash)`.
        fn get_series_game_address_by_class_hash(
            self: @ContractState, name: felt252, game_number: u16, class_hash: ClassHash,
        ) -> ContractAddress {
            let mut factory_world = self.world_default();
            let series_contract: SeriesContract = factory_world
                .read_model((name, game_number, class_hash));
            return series_contract.contract_address;
        }


        /// Returns all contract addresses in a series for a given selector.
        fn get_all_series_game_addresses_by_selector(
            self: @ContractState, name: felt252, contract_selector: felt252,
        ) -> Array<ContractAddress> {
            let mut factory_world = self.world_default();
            let series: Series = factory_world.read_model(name);
            assert(series.owner.is_non_zero(), errors::SERIES_DOES_NOT_EXIST);

            let mut games: Array<ContractAddress> = array![];

            let mut game_number: u16 = 1;
            while game_number <= series.game_count {
                let series_contract_by_selector: SeriesContractBySelector = factory_world
                    .read_model((name, game_number, contract_selector));
                games.append(series_contract_by_selector.contract_address);
                game_number += 1;
            }

            return games;
        }

        /// Returns all contract addresses in a series for a given class hash.
        fn get_all_series_game_addresses_by_class_hash(
            self: @ContractState, name: felt252, class_hash: ClassHash,
        ) -> Array<ContractAddress> {
            let mut factory_world = self.world_default();
            let series: Series = factory_world.read_model(name);
            assert(series.owner.is_non_zero(), errors::SERIES_DOES_NOT_EXIST);

            let mut games: Array<ContractAddress> = array![];

            let mut game_number: u16 = 1;
            while game_number <= series.game_count {
                let series_contract: SeriesContract = factory_world
                    .read_model((name, game_number, class_hash));
                games.append(series_contract.contract_address);
                game_number += 1;
            }

            return games;
        }
    }


    #[abi(embed_v0)]
    impl IWorldFactoryImpl of IWorldFactory<ContractState> {
        /// Sets non-array config fields for a version.
        ///
        /// First call initializes owner; subsequent calls are owner-gated updates.
        fn set_factory_config(
            ref self: ContractState,
            version: felt252,
            world_class_hash: ClassHash,
            default_namespace: ByteArray,
            default_namespace_writer_all: bool,
        ) {
            let mut factory_world = self.world_default();

            let config_owner: ContractAddress = FactoryConfigUtilImpl::get_member(
                factory_world, version, selector!("owner"),
            );
            let caller = starknet::get_caller_address();

            if config_owner.is_non_zero() {
                assert(caller == config_owner, errors::NOT_CONFIG_OWNER);
            } else {
                FactoryConfigUtilImpl::set_member(
                    ref factory_world, version, selector!("owner"), caller,
                );
            }
            FactoryConfigUtilImpl::set_member(
                ref factory_world, version, selector!("world_class_hash"), world_class_hash,
            );
            FactoryConfigUtilImpl::set_member(
                ref factory_world, version, selector!("default_namespace"), default_namespace,
            );
            FactoryConfigUtilImpl::set_member(
                ref factory_world,
                version,
                selector!("default_namespace_writer_all"),
                default_namespace_writer_all,
            );
            // Any setter call updates config revision to invalidate stale deployment cursors.
            FactoryConfigUtilImpl::bump_revision(ref factory_world, version);
        }

        /// Replaces indexed contract definitions for a config version.
        fn set_factory_config_contracts(
            ref self: ContractState, version: felt252, contracts: Array<FactoryConfigContractData>,
        ) {
            self.assert_config_owner(version);
            let mut factory_world = self.world_default();

            let mut contracts_len: u64 = 0;
            for contract in contracts.span() {
                let contract: FactoryConfigContractData = *contract;
                factory_world
                    .write_model(
                        @FactoryConfigContract {
                            version,
                            index: contracts_len,
                            selector: contract.selector,
                            class_hash: contract.class_hash,
                            init_args: contract.init_args,
                        },
                    );
                contracts_len += 1;
            }

            FactoryConfigUtilImpl::set_member(
                ref factory_world, version, selector!("contracts_len"), contracts_len,
            );
            FactoryConfigUtilImpl::bump_revision(ref factory_world, version);
        }

        /// Replaces indexed model class hashes for a config version.
        fn set_factory_config_models(
            ref self: ContractState, version: felt252, models: Array<ClassHash>,
        ) {
            self.assert_config_owner(version);
            let mut factory_world = self.world_default();

            let mut models_len: u64 = 0;
            for class_hash in models.span() {
                factory_world
                    .write_model(
                        @FactoryConfigModel { version, index: models_len, class_hash: *class_hash },
                    );
                models_len += 1;
            }

            FactoryConfigUtilImpl::set_member(
                ref factory_world, version, selector!("models_len"), models_len,
            );
            FactoryConfigUtilImpl::bump_revision(ref factory_world, version);
        }

        /// Replaces indexed event class hashes for a config version.
        fn set_factory_config_events(
            ref self: ContractState, version: felt252, events: Array<ClassHash>,
        ) {
            self.assert_config_owner(version);
            let mut factory_world = self.world_default();

            let mut events_len: u64 = 0;
            for class_hash in events.span() {
                factory_world
                    .write_model(
                        @FactoryConfigEvent { version, index: events_len, class_hash: *class_hash },
                    );
                events_len += 1;
            }

            FactoryConfigUtilImpl::set_member(
                ref factory_world, version, selector!("events_len"), events_len,
            );
            FactoryConfigUtilImpl::bump_revision(ref factory_world, version);
        }

        /// Replaces indexed library definitions for a config version.
        fn set_factory_config_libraries(
            ref self: ContractState, version: felt252, libraries: Array<FactoryConfigLibraryData>,
        ) {
            self.assert_config_owner(version);
            let mut factory_world = self.world_default();

            let mut libraries_len: u64 = 0;
            for library in libraries.span() {
                let library = library.clone();
                factory_world
                    .write_model(
                        @FactoryConfigLibrary {
                            version,
                            index: libraries_len,
                            class_hash: library.class_hash,
                            name: library.name.clone(),
                            library_version: library.version.clone(),
                        },
                    );
                libraries_len += 1;
            }

            FactoryConfigUtilImpl::set_member(
                ref factory_world, version, selector!("libraries_len"), libraries_len,
            );
            FactoryConfigUtilImpl::bump_revision(ref factory_world, version);
        }

        /// Deploys (or resumes deploying) a world from a factory config.
        ///
        /// The deployment is resumable: this function may return early once the per-call action
        /// budget is consumed, and can be called again with the same `(config_version, game_name)`.
        fn create_game(
            ref self: ContractState,
            game_name: felt252,
            max_actions: u64,
            factory_config_version: felt252,
            series_name: felt252,
            series_game_number: u16,
        ) {
            let mut factory_world = self.world_default();
            let mut cursor: FactoryDeploymentCursor = factory_world
                .read_model((factory_config_version, game_name));
            cursor.version = factory_config_version;
            cursor.name = game_name;

            assert(max_actions > 0, errors::MAX_ACTIONS_MUST_BE_GT_ZERO);
            assert(!cursor.completed, errors::DEPLOYMENT_ALREADY_COMPLETED);
            // Series-specific preflight checks (no-op when `series_name == 0`).
            FactorySeriesImpl::validate_create_game_series(
                ref factory_world, series_name, series_game_number,
            );

            let config: FactoryConfig = factory_world.read_model(factory_config_version);
            if cursor.config_revision == 0 {
                cursor.config_revision = config.revision;
            } else {
                assert(
                    cursor.config_revision == config.revision,
                    errors::CONFIG_MODIFIED_DURING_DEPLOYMENT,
                );
            }

            let max_actions = cursor.total_actions + max_actions;
            let version = config.version;
            let contracts_len = config.contracts_len;
            let libraries_len = config.libraries_len;
            let models_len = config.models_len;
            let events_len = config.events_len;
            let default_namespace = config.default_namespace.clone();
            let default_namespace_writer_all = config.default_namespace_writer_all;

            // Reuse world address when resuming an in-progress deployment.
            let deployed_world = if let Some(world_address) = cursor.world_address {
                IWorldDispatcher { contract_address: world_address }
            } else {
                let wd = self.deploy_world(game_name, config.world_class_hash);
                cursor.world_address = Some(wd.contract_address);
                wd.register_namespace(default_namespace.clone());
                wd
            };

            // Phase 1: contracts (registration + permissions), resumable.
            if FactoryConfigSyncImpl::sync_contract_setup(
                version,
                contracts_len,
                default_namespace.clone(),
                default_namespace_writer_all,
                ref factory_world,
                deployed_world,
                ref cursor,
                max_actions,
                game_name,
                series_name,
                series_game_number,
            ) {
                return;
            }

            // Phase 2: finalize series sequence state, when applicable.
            FactorySeriesImpl::sync_series_game_count(
                ref factory_world, series_name, series_game_number,
            );

            // Phase 3: register libraries, models, then events.
            if FactoryConfigSyncImpl::sync_library_registrations(
                version,
                libraries_len,
                default_namespace.clone(),
                ref factory_world,
                deployed_world,
                ref cursor,
                max_actions,
            ) {
                return;
            }

            if FactoryConfigSyncImpl::sync_model_registrations(
                version,
                models_len,
                default_namespace.clone(),
                ref factory_world,
                deployed_world,
                ref cursor,
                max_actions,
            ) {
                return;
            }

            if FactoryConfigSyncImpl::sync_event_registrations(
                version,
                events_len,
                default_namespace.clone(),
                ref factory_world,
                deployed_world,
                ref cursor,
                max_actions,
            ) {
                return;
            }

            // Phase 4: initialize contracts after all registrations are finalized.
            if FactoryConfigSyncImpl::sync_contract_inits(
                version,
                contracts_len,
                libraries_len,
                models_len,
                events_len,
                ref factory_world,
                deployed_world,
                ref cursor,
                max_actions,
            ) {
                return;
            }

            let world_ref = WorldDeployed {
                name: game_name,
                address: deployed_world.contract_address,
                block_number: starknet::get_block_number(),
                tx_hash: starknet::get_tx_info().transaction_hash,
            };
            factory_world.write_model(@world_ref);

            cursor.completed = true;
            factory_world.write_model(@cursor);
        }
    }


    #[abi(embed_v0)]
    impl IWorldFactoryMMRImpl of IWorldFactoryMMR<ContractState> {
        fn get_factory_mmr_contract_version(
            self: @ContractState, addr: ContractAddress,
        ) -> felt252 {
            let mut factory_world = self.world_default();
            let mmr_registration: MMRRegistration = factory_world.read_model(addr);
            return mmr_registration.version;
        }
    }

    #[generate_trait]
    impl FactoryConfigUtilImpl of FactoryConfigUtilTrait {
        /// Reads a single `FactoryConfig` member by selector.
        fn get_member<T, impl TSerde: Serde<T>, impl TDojoStore: DojoStore<T>>(
            world: dojo::world::WorldStorage, version: felt252, selector: felt252,
        ) -> T {
            world.read_member(Model::<FactoryConfig>::ptr_from_keys(version), selector)
        }

        /// Writes a single `FactoryConfig` member by selector.
        fn set_member<T, impl TSerde: Serde<T>, impl TDrop: Drop<T>, impl TDojoStore: DojoStore<T>>(
            ref world: dojo::world::WorldStorage, version: felt252, selector: felt252, value: T,
        ) {
            world.write_member(Model::<FactoryConfig>::ptr_from_keys(version), selector, value)
        }

        /// Increments `FactoryConfig.revision` for `version` and returns the new value.
        fn bump_revision(ref world: dojo::world::WorldStorage, version: felt252) -> u64 {
            let revision: u64 = Self::get_member(world, version, selector!("revision"));
            let next_revision = revision + 1;
            Self::set_member(ref world, version, selector!("revision"), next_revision);
            next_revision
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Default world storage for the factory.
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@"wf")
        }

        /// Ensures the caller matches the config owner for the given version.
        fn assert_config_owner(self: @ContractState, version: felt252) {
            let mut factory_world = self.world_default();
            let config_owner: ContractAddress = FactoryConfigUtilImpl::get_member(
                factory_world, version, selector!("owner"),
            );
            assert(config_owner.is_non_zero(), errors::CONFIG_NOT_INITIALIZED);
            assert(starknet::get_caller_address() == config_owner, errors::NOT_CONFIG_OWNER);
        }

        /// Deploys a new world and returns its address.
        fn deploy_world(
            self: @ContractState, name: felt252, world_class_hash: ClassHash,
        ) -> IWorldDispatcher {
            let (world_address, _ctor_result) = starknet::syscalls::deploy_syscall(
                world_class_hash.try_into().unwrap(), name, [].span(), false,
            )
                .unwrap_syscall();

            IWorldDispatcher { contract_address: world_address }
        }
    }
}
