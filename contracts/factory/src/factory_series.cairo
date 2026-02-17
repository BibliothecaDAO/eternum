//! Series-specific helpers for factory deployment.
//!
//! This module isolates series validation and writes from the generic deployment sync code.

use core::num::traits::Zero;
use dojo::model::ModelStorage;
use starknet::{ClassHash, ContractAddress};
use crate::series_models::{Series, SeriesContract, SeriesContractBySelector, SeriesGame};

#[generate_trait]
pub impl FactorySeriesImpl of FactorySeriesTrait {
    /// Validates series inputs for `create_game`.
    ///
    /// If `series_name` is non-zero:
    /// - caller must be the series owner,
    /// - game number must be > 0,
    /// - game number must be either current `game_count` (already finalized on a previous resume)
    ///   or `game_count + 1` (next contiguous game).
    fn validate_create_game_series(
        ref factory_world: dojo::world::WorldStorage, series_name: felt252, series_game_number: u16,
    ) {
        if series_name.is_non_zero() {
            let series: Series = factory_world.read_model(series_name);
            assert(starknet::get_caller_address() == series.owner, 'not series owner');
            assert(series_game_number > 0, 'zero series game number');
            if series_game_number > series.game_count {
                assert(series_game_number == series.game_count + 1, 'incorrect series game number');
            }
        }
    }

    /// Writes series indices for a newly registered contract.
    ///
    /// No-op when `series_name` is zero.
    fn on_contract_registered(
        ref factory_world: dojo::world::WorldStorage,
        series_name: felt252,
        series_game_number: u16,
        selector: felt252,
        class_hash: ClassHash,
        contract_address: ContractAddress,
    ) {
        if series_name.is_non_zero() {
            factory_world
                .write_model(
                    @SeriesContract {
                        name: series_name,
                        game_number: series_game_number,
                        contract_class_hash: class_hash,
                        contract_address,
                    },
                );
            factory_world
                .write_model(
                    @SeriesContractBySelector {
                        name: series_name,
                        game_number: series_game_number,
                        contract_selector: selector,
                        contract_address,
                    },
                );
            factory_world
                .write_model(
                    @SeriesGame {
                        contract_address, name: series_name, game_number: series_game_number,
                    },
                );
        }
    }

    /// Advances `Series.game_count` for the deployment if required.
    ///
    /// Enforces strict sequence: when advanced, resulting `game_count` must equal
    /// `series_game_number`.
    fn sync_series_game_count(
        ref factory_world: dojo::world::WorldStorage, series_name: felt252, series_game_number: u16,
    ) {
        if series_name.is_zero() {
            return;
        }

        let mut series: Series = factory_world.read_model(series_name);
        // Already synchronized for this game number.
        if series_game_number <= series.game_count {
            return;
        }

        // Advance by exactly one game and enforce contiguous numbering.
        series.game_count += 1;
        assert(series.game_count == series_game_number, 'incorrect series game number');
        factory_world.write_model(@series);
    }
}
