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
    use dojo::model::ModelStorage;
    use dojo::utils::bytearray_hash;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use starknet::{ClassHash, ContractAddress, SyscallResultTrait};
    use crate::factory_models::{
        FactoryConfig, FactoryConfigContract, FactoryConfigOwner, FactoryDeploymentCursor,
    };
    use crate::interface::{IWorldFactory, IWorldFactorySeries};
    use crate::series_models::{Series, SeriesContract, SeriesContractBySelector, SeriesGame};
    use crate::world_models::{WorldContract, WorldDeployed};

    mod errors {
        pub const DEPLOYMENT_ALREADY_COMPLETED: felt252 = 'deployment already completed';
        pub const NOT_CONFIG_OWNER: felt252 = 'not config owner';
        pub const NOT_SERIES_OWNER: felt252 = 'not series owner';
        pub const SERIES_DOES_NOT_EXIST: felt252 = 'series does not exist';
        pub const ZERO_SERIES_GAME_NUMBER: felt252 = 'zero series game number';
        pub const INCORRECT_SERIES_GAME_NUMBER: felt252 = 'incorrect series game number';
        pub const EXPECTED_NO_OWNER: felt252 = 'no series owner expected';
    }

    #[abi(embed_v0)]
    impl IWorldFactorySeriesImpl of IWorldFactorySeries<ContractState> {
        fn set_series_config(ref self: ContractState, name: felt252) {
            let mut factory_world = self.world_default();

            let mut series: Series = factory_world.read_model(name);
            assert(series.owner.is_zero(), errors::EXPECTED_NO_OWNER);

            series.owner = starknet::get_caller_address();
            factory_world.write_model(@series);
        }

        fn get_series_game_data(self: @ContractState, addr: ContractAddress) -> (felt252, u16) {
            let mut factory_world = self.world_default();
            let series_game: SeriesGame = factory_world.read_model(addr);
            return (series_game.name, series_game.game_number);
        }

        fn get_series_game_address_by_selector(
            self: @ContractState, name: felt252, game_number: u16, selector: felt252,
        ) -> ContractAddress {
            let mut factory_world = self.world_default();
            let series_contract: SeriesContractBySelector = factory_world
                .read_model((name, game_number, selector));
            return series_contract.contract_address;
        }

        fn get_series_game_address_by_class_hash(
            self: @ContractState, name: felt252, game_number: u16, class_hash: ClassHash,
        ) -> ContractAddress {
            let mut factory_world = self.world_default();
            let series_contract: SeriesContract = factory_world
                .read_model((name, game_number, class_hash));
            return series_contract.contract_address;
        }


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
        fn set_factory_config(ref self: ContractState, config: FactoryConfig) {
            let mut factory_world = self.world_default();

            let config_owner: FactoryConfigOwner = factory_world.read_model(config.version);

            if config_owner.contract_address.is_non_zero() {
                assert(
                    starknet::get_caller_address() == config_owner.contract_address,
                    errors::NOT_CONFIG_OWNER,
                );
            }

            factory_world
                .write_model(
                    @FactoryConfigOwner {
                        version: config.version, contract_address: starknet::get_caller_address(),
                    },
                );

            factory_world.write_model(@config);
        }

        fn create_game(
            ref self: ContractState,
            game_name: felt252,
            factory_config_version: felt252,
            series_name: felt252,
            series_game_number: u16,
        ) {
            let mut factory_world = self.world_default();
            let mut series: Series = factory_world.read_model(series_name);

            if series_name.is_non_zero() {
                assert(starknet::get_caller_address() == series.owner, errors::NOT_SERIES_OWNER);
                assert(series_game_number > 0, errors::ZERO_SERIES_GAME_NUMBER);
            }

            let factory_config: FactoryConfig = factory_world.read_model(factory_config_version);
            let mut cursor: FactoryDeploymentCursor = factory_world
                .read_model((factory_config_version, game_name));

            let max_actions = cursor.total_actions + factory_config.max_actions;

            assert(!cursor.completed, errors::DEPLOYMENT_ALREADY_COMPLETED);

            // Deploy the world if not done already.
            //
            let world_class_hash = factory_config.world_class_hash;
            let deployed_world = if let Some(world_address) = cursor.world_address {
                IWorldDispatcher { contract_address: world_address }
            } else {
                let wd = self.deploy_world(game_name, world_class_hash);
                cursor.world_address = Some(wd.contract_address);

                // Register a default namespace in the new world which is permissionless.
                wd.register_namespace(factory_config.default_namespace.clone());

                factory_world.write_model(@cursor);
                wd
            };

            // Sync contracts.
            //
            // TODO: we can optimize by first comparing the length of the array with the cursor, to
            // avoid iterating for nothing.
            let mut contract_idx: u64 = 0;
            for contract in factory_config.contracts.span() {
                if cursor.contract_cursor > contract_idx {
                    contract_idx += 1;
                    continue;
                }

                let addr = deployed_world
                    .register_contract(
                        *contract.selector,
                        factory_config.default_namespace.clone(),
                        *contract.class_hash,
                    );

                factory_world
                    .write_model(
                        @WorldContract {
                            name: game_name,
                            contract_selector: *contract.selector,
                            contract_address: addr,
                        },
                    );

                if series_name.is_non_zero() {
                    // set series data
                    factory_world
                        .write_model(
                            @SeriesContract {
                                name: series_name,
                                game_number: series_game_number,
                                contract_class_hash: *contract.class_hash,
                                contract_address: addr,
                            },
                        );

                    factory_world
                        .write_model(
                            @SeriesContractBySelector {
                                name: series_name,
                                game_number: series_game_number,
                                contract_selector: *contract.selector,
                                contract_address: addr,
                            },
                        );

                    factory_world
                        .write_model(
                            @SeriesGame {
                                contract_address: addr,
                                name: series_name,
                                game_number: series_game_number,
                            },
                        );
                }

                contract_idx += 1;
                cursor.total_actions += 1;
                cursor.contract_cursor += 1;

                if cursor.total_actions >= max_actions {
                    factory_world.write_model(@cursor);
                    return;
                }
            }

            if series_name.is_non_zero() && series_game_number > series.game_count {
                series.game_count += 1;
                assert(
                    series.game_count == series_game_number, errors::INCORRECT_SERIES_GAME_NUMBER,
                );

                factory_world.write_model(@series);
            }

            // Sync libraries.
            let mut library_idx: u64 = 0;
            for library in factory_config.libraries.span() {
                if cursor.library_cursor > library_idx {
                    library_idx += 1;
                    continue;
                }

                // Class hashes are already known, so it may not be necessary to emit an other
                // event.
                let _class_hash = deployed_world
                    .register_library(
                        factory_config.default_namespace.clone(),
                        *library.class_hash,
                        library.name.clone(),
                        library.version.clone(),
                    );

                library_idx += 1;
                cursor.total_actions += 1;
                cursor.library_cursor += 1;

                if cursor.total_actions >= max_actions {
                    factory_world.write_model(@cursor);
                    return;
                }
            }

            // Sync models.
            //
            // TODO: we can optimize by first comparing the length of the array with the cursor, to
            // avoid iterating for nothing.
            let mut model_idx: u64 = 0;
            for class_hash in factory_config.models.span() {
                if cursor.model_cursor > model_idx {
                    model_idx += 1;
                    continue;
                }

                deployed_world
                    .register_model(factory_config.default_namespace.clone(), *class_hash);

                model_idx += 1;
                cursor.total_actions += 1;
                cursor.model_cursor += 1;

                if cursor.total_actions >= max_actions {
                    factory_world.write_model(@cursor);
                    return;
                }
            }

            // Sync events.
            //
            // TODO: we can optimize by first comparing the length of the array with the cursor, to
            // avoid iterating for nothing.
            let mut event_idx: u64 = 0;
            for class_hash in factory_config.events.span() {
                if cursor.event_cursor > event_idx {
                    event_idx += 1;
                    continue;
                }

                deployed_world
                    .register_event(factory_config.default_namespace.clone(), *class_hash);

                event_idx += 1;
                cursor.total_actions += 1;
                cursor.event_cursor += 1;

                if cursor.total_actions >= max_actions {
                    factory_world.write_model(@cursor);
                    return;
                }
            }

            let namespace_hash = bytearray_hash(@factory_config.default_namespace);

            // Sync permissions for the contracts.
            //
            let mut permission_idx: u64 = 0;
            for contract in factory_config.contracts.span() {
                if cursor.permission_cursor > permission_idx {
                    permission_idx += 1;
                    continue;
                }

                // Get the address of the contract from the factory world, indexed by the name of
                // the world and the selector of the contract.
                let wc: WorldContract = factory_world.read_model((game_name, *contract.selector));
                let wc_address: ContractAddress = wc.contract_address;

                // TODO: here, the permission idx is actually set at the contract level, and not at
                // the resource level.
                // So we may have more actions than expected based on the config.
                // We need to adjust that in the future, since currently most people use the factory
                // with the default namespace writer all.
                // However, permissions are very simple calls, so they shouldn't add too much
                // overhead.

                if factory_config.default_namespace_writer_all {
                    deployed_world.grant_writer(namespace_hash, wc_address);
                }

                for resource in contract.writer_of_resources {
                    deployed_world.grant_writer(*resource, wc_address);
                }

                for resource in contract.owner_of_resources {
                    deployed_world.grant_owner(*resource, wc_address);
                }

                permission_idx += 1;
                cursor.total_actions += 1;
                cursor.permission_cursor += 1;

                if cursor.total_actions >= max_actions {
                    factory_world.write_model(@cursor);
                    return;
                }
            }

            // Initialize the dojo contracts.
            //
            let mut init_idx: u64 = 0;
            for contract in factory_config.contracts.span() {
                let contract: FactoryConfigContract = *contract;

                if cursor.init_cursor > init_idx {
                    init_idx += 1;
                    continue;
                }

                let _wc: WorldContract = factory_world.read_model((game_name, contract.selector));
                deployed_world.init_contract(contract.selector, contract.init_args);

                init_idx += 1;
                cursor.total_actions += 1;
                cursor.init_cursor += 1;

                if cursor.total_actions >= max_actions {
                    factory_world.write_model(@cursor);
                    return;
                }
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

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Default world storage for the factory.
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@"wf")
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
