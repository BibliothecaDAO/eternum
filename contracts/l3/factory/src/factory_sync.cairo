//! Deployment synchronization helpers for the factory.
//!
//! This module contains the stateful "resume-safe" loops used by `create_game`.
//! Each loop advances a cursor and persists it when the action budget is reached.

use dojo::model::ModelStorage;
use dojo::utils::bytearray_hash;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use crate::factory_mmr::FactoryMmrImpl;
use crate::factory_models::{
    FactoryConfigContract, FactoryConfigEvent, FactoryConfigLibrary, FactoryConfigModel,
    FactoryDeploymentCursor,
};
use crate::factory_series::FactorySeriesImpl;
use crate::world_models::WorldContract;

#[generate_trait]
pub impl FactoryConfigSyncImpl of FactoryConfigSyncTrait {
    /// Persists the deployment cursor and signals an early return when the action budget is
    /// reached.
    ///
    /// Returns `true` when the caller should stop the current transaction.
    fn flush_cursor_if_budget_reached(
        ref factory_world: dojo::world::WorldStorage,
        ref cursor: FactoryDeploymentCursor,
        max_actions: u64,
    ) -> bool {
        if cursor.total_actions >= max_actions {
            factory_world.write_model(@cursor);
            true
        } else {
            false
        }
    }

    /// Performs the contract phase for the current deployment cursor.
    ///
    /// For each contract, this does registration, world mapping, optional MMR/series side effects,
    /// and optional default namespace writer grant.
    /// Returns `true` when the action budget is reached and cursor is persisted.
    fn sync_contract_setup(
        version: felt252,
        contracts_len: u64,
        default_namespace: ByteArray,
        default_namespace_writer_all: bool,
        ref factory_world: dojo::world::WorldStorage,
        deployed_world: IWorldDispatcher,
        ref cursor: FactoryDeploymentCursor,
        max_actions: u64,
        game_name: felt252,
        series_name: felt252,
        series_game_number: u16,
    ) -> bool {
        let namespace_hash = bytearray_hash(@default_namespace);
        let mut contract_idx: u64 = cursor.contract_cursor;

        while contract_idx < contracts_len {
            let contract: FactoryConfigContract = factory_world.read_model((version, contract_idx));
            // Register contract into the deployed world under the default namespace.
            let contract_address = deployed_world
                .register_contract(
                    contract.selector, default_namespace.clone(), contract.class_hash,
                );

            // Store a reverse lookup in factory state so clients can resolve addresses by
            // world+selector.
            factory_world
                .write_model(
                    @WorldContract {
                        name: game_name, contract_selector: contract.selector, contract_address,
                    },
                );

            // Feature hooks that react to contract registration.
            FactoryMmrImpl::on_contract_registered(
                ref factory_world, contract.selector, contract_address, version,
            );
            FactorySeriesImpl::on_contract_registered(
                ref factory_world,
                series_name,
                series_game_number,
                contract.selector,
                contract.class_hash,
                contract_address,
            );

            // Optional convenience permission: allow all deployed systems to write default
            // namespace.
            if default_namespace_writer_all {
                deployed_world.grant_writer(namespace_hash, contract_address);
            }

            contract_idx += 1;
            cursor.total_actions += 1;
            cursor.contract_cursor = contract_idx;

            // Persist progress and exit early when the budget for this tx is consumed.
            if Self::flush_cursor_if_budget_reached(ref factory_world, ref cursor, max_actions) {
                return true;
            }
        }

        false
    }

    /// Initializes contracts after all registrations (contracts/libraries/models/events) are done.
    ///
    /// Progress is derived from `cursor.total_actions`:
    /// `init_idx = total_actions - (contracts_len + libraries_len + models_len + events_len)`.
    /// Returns `true` when the action budget is reached and cursor is persisted.
    fn sync_contract_inits(
        version: felt252,
        contracts_len: u64,
        libraries_len: u64,
        models_len: u64,
        events_len: u64,
        ref factory_world: dojo::world::WorldStorage,
        deployed_world: IWorldDispatcher,
        ref cursor: FactoryDeploymentCursor,
        max_actions: u64,
    ) -> bool {
        let pre_init_actions = contracts_len + libraries_len + models_len + events_len;
        let mut init_idx: u64 = 0;
        if cursor.total_actions > pre_init_actions {
            init_idx = cursor.total_actions - pre_init_actions;
        }

        while init_idx < contracts_len {
            let contract: FactoryConfigContract = factory_world.read_model((version, init_idx));
            deployed_world.init_contract(contract.selector, contract.init_args);

            init_idx += 1;
            cursor.total_actions += 1;

            // Persist progress and stop when action budget is exhausted.
            if Self::flush_cursor_if_budget_reached(ref factory_world, ref cursor, max_actions) {
                return true;
            }
        }

        false
    }

    /// Registers pending libraries for the current deployment cursor.
    ///
    /// Returns `true` when the action budget is reached and cursor is persisted.
    fn sync_library_registrations(
        version: felt252,
        libraries_len: u64,
        default_namespace: ByteArray,
        ref factory_world: dojo::world::WorldStorage,
        deployed_world: IWorldDispatcher,
        ref cursor: FactoryDeploymentCursor,
        max_actions: u64,
    ) -> bool {
        let mut library_idx: u64 = cursor.library_cursor;
        while library_idx < libraries_len {
            let library: FactoryConfigLibrary = factory_world.read_model((version, library_idx));
            let _class_hash = deployed_world
                .register_library(
                    default_namespace.clone(),
                    library.class_hash,
                    library.name.clone(),
                    library.library_version.clone(),
                );

            library_idx += 1;
            cursor.total_actions += 1;
            cursor.library_cursor = library_idx;

            // Persist progress and stop when action budget is exhausted.
            if Self::flush_cursor_if_budget_reached(ref factory_world, ref cursor, max_actions) {
                return true;
            }
        }

        false
    }

    /// Registers pending models for the current deployment cursor.
    ///
    /// Returns `true` when the action budget is reached and cursor is persisted.
    fn sync_model_registrations(
        version: felt252,
        models_len: u64,
        default_namespace: ByteArray,
        ref factory_world: dojo::world::WorldStorage,
        deployed_world: IWorldDispatcher,
        ref cursor: FactoryDeploymentCursor,
        max_actions: u64,
    ) -> bool {
        let mut model_idx: u64 = cursor.model_cursor;
        while model_idx < models_len {
            let config_model: FactoryConfigModel = factory_world.read_model((version, model_idx));
            deployed_world.register_model(default_namespace.clone(), config_model.class_hash);

            model_idx += 1;
            cursor.total_actions += 1;
            cursor.model_cursor = model_idx;

            // Persist progress and stop when action budget is exhausted.
            if Self::flush_cursor_if_budget_reached(ref factory_world, ref cursor, max_actions) {
                return true;
            }
        }

        false
    }

    /// Registers pending events for the current deployment cursor.
    ///
    /// Returns `true` when the action budget is reached and cursor is persisted.
    fn sync_event_registrations(
        version: felt252,
        events_len: u64,
        default_namespace: ByteArray,
        ref factory_world: dojo::world::WorldStorage,
        deployed_world: IWorldDispatcher,
        ref cursor: FactoryDeploymentCursor,
        max_actions: u64,
    ) -> bool {
        let mut event_idx: u64 = cursor.event_cursor;
        while event_idx < events_len {
            let config_event: FactoryConfigEvent = factory_world.read_model((version, event_idx));
            deployed_world.register_event(default_namespace.clone(), config_event.class_hash);

            event_idx += 1;
            cursor.total_actions += 1;
            cursor.event_cursor = event_idx;

            // Persist progress and stop when action budget is exhausted.
            if Self::flush_cursor_if_budget_reached(ref factory_world, ref cursor, max_actions) {
                return true;
            }
        }

        false
    }
}
