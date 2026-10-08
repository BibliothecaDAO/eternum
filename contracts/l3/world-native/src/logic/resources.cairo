use starknet::storage::{StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::resources::{Production, ResourceKey, Weight, assert_resource, has_castle_limit, has_production};

#[inline(never)]
pub fn assert_exists(key: ResourceKey) {
    let state = crate::state::read();
    assert!(state.resources.resource_exists.read((key.game_id, key.entity_id)), "missing resource owner");
}

#[inline(never)]
pub fn balance(key: ResourceKey, resource_type: u8) -> u128 {
    let state = crate::state::read();
    assert_exists(key);
    assert_resource(resource_type);
    state.resources.balances.read((key.game_id, key.entity_id, resource_type))
}

#[inline(never)]
pub fn production(key: ResourceKey, resource_type: u8) -> Production {
    let state = crate::state::read();
    assert_exists(key);
    assert_resource(resource_type);
    if !has_production(resource_type) {
        return Default::default();
    }
    state.resources.productions.read((key.game_id, key.entity_id, resource_type))
}

pub fn weight(key: ResourceKey) -> Weight {
    let state = crate::state::read();
    assert_exists(key);
    state.resources.weights.read((key.game_id, key.entity_id))
}

/// A board realm keeps each of wheat, labor and troops up to its castle's base: that many deploys of its castle level's
/// cap. Every other store, and every store off a board, has no limit of its own.
#[inline(never)]
pub fn store_limit(key: ResourceKey, resource_type: u8) -> Option<u128> {
    if !has_castle_limit(resource_type) {
        return None;
    }
    let preset = crate::logic::preset_record::for_game(key.game_id);
    let board = preset.board_terms.read()?;
    let base = crate::state::read().structures.structures.entry((key.game_id, key.entity_id)).base.read();
    if base.category != crate::taxonomy::REALM_CATEGORY {
        return None;
    }
    let cap = crate::troops::deployment_cap(preset.rules.troop_limit_config.read(), base.level);
    let castle_base = Into::<u32, u128>::into(cap)
        * Into::<u8, u128>::into(board.castle_store_deploys)
        * crate::rules::RESOURCE_PRECISION;
    let row = if resource_type == crate::resources::WHEAT {
        Some(crate::research::ROW_FARM)
    } else if resource_type == crate::resources::LABOR {
        Some(crate::research::ROW_WORKSHOP)
    } else {
        None
    };
    let stores: u128 = row
        .map(|row| crate::research::picks(crate::logic::research::learned(key), row, crate::research::CHOICE_STORE))
        .unwrap_or(0)
        .into();
    Some(castle_base * (10000 + stores * board.storage_step_bps.into()) / 10000)
}

pub fn rule(game_id: u32, resource_type: u8) -> crate::resources::ResourceRule {
    let preset = crate::logic::preset_record::for_game(game_id);
    assert_resource(resource_type);
    let (unit_weight, rates) = preset.resource_rules.read(resource_type);
    crate::resources::ResourceRule {
        resource_type,
        unit_weight,
        realm_rate: (rates % crate::resources::RESOURCE_RATE_SCALE).try_into().unwrap(),
        village_rate: (rates / crate::resources::RESOURCE_RATE_SCALE).try_into().unwrap(),
    }
}

/// The armies tick in seconds: production pays in whole ticks of it.
pub fn production_tick(game_id: u32) -> u32 {
    crate::logic::preset_record::for_game(game_id).rules.tick_config.armies_tick_in_seconds.read().try_into().unwrap()
}

pub fn production_start(game_id: u32, game_context: crate::commands::ExecutionContext) -> u32 {
    if crate::rules::rule_enabled(game_context.rules.unbox(), crate::rules::PRODUCTION_START) {
        game_context.game.unbox().start_main_at.try_into().unwrap()
    } else {
        0
    }
}

#[starknet::component]
pub mod ResourceState {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::{RowDeleted, RowSet};
    use crate::resources::{
        Production, ResourceKey, SettledResource, Weight, add, assert_production, has_production, settle, spend,
    };

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    pub struct Storage {
        #[flat]
        pub data: crate::state::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        RowDeleted: RowDeleted,
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn burn_resource(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            resource_type: u8,
            amount: u128,
            unit_weight: u128,
        ) {
            // Explicit burns spend the stored balance; they never harvest pending production.
            let mut balance = crate::logic::resources::balance(key, resource_type);
            let mut weight = crate::logic::resources::weight(key);
            spend(resource_type, ref balance, ref weight, amount, unit_weight);
            self.write_balance(key, resource_type, balance);
            self.write_weight(key, weight);
        }
        fn destroy(ref self: ComponentState<TContractState>, key: ResourceKey) {
            crate::logic::resources::assert_exists(key);
            for resource_type in 1_u8..59 {
                self.write_balance(key, resource_type, 0);
                self.write_production(key, resource_type, Default::default());
            }
            self.data.resources.weights.write((key.game_id, key.entity_id), Default::default());
            self.data.resources.resource_exists.write((key.game_id, key.entity_id), false);
            self
                .emit(
                    RowDeleted {
                        version: 1,
                        model: 'ResourceWeight',
                        keys: array![key.game_id.into(), key.entity_id.into()].span(),
                    },
                );
        }
        fn change_capacity(ref self: ComponentState<TContractState>, key: ResourceKey, amount: u128, increase: bool) {
            crate::logic::resources::assert_exists(key);
            let mut weight = self.data.resources.weights.read((key.game_id, key.entity_id));
            if weight.capacity != 0xffffffffffffffffffffffffffffffff {
                weight.capacity = if increase {
                    weight.capacity + amount
                } else {
                    weight.capacity - amount
                };
                self.write_weight(key, weight);
            }
        }
        fn initialize(ref self: ComponentState<TContractState>, key: ResourceKey, capacity: u128) {
            assert!(key.game_id != 0 && key.entity_id != 0, "reserved resource key");
            assert!(
                !self.data.resources.resource_exists.read((key.game_id, key.entity_id)),
                "resources already initialized",
            );
            let weight = Weight { capacity, weight: 0 };
            self.data.resources.weights.write((key.game_id, key.entity_id), weight);
            self.data.resources.resource_exists.write((key.game_id, key.entity_id), true);
            self.emit_weight(key, weight);
        }

        fn settle_resource(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            resource_type: u8,
            unit_weight: u128,
            now: u32,
            start_at: u32,
        ) -> u128 {
            let resource = self.load_settled(key, resource_type, unit_weight, now, start_at);
            self.commit_resource(key, resource_type, resource);
            resource.balance
        }
        // A rate or a storage limit applies from the moment it changes: what accrued before settles under the old one.
        fn settle_production(ref self: ComponentState<TContractState>, key: ResourceKey, now: u32, start_at: u32) {
            for resource_type in 1_u8..59 {
                if has_production(resource_type)
                    && crate::logic::resources::production(key, resource_type).building_count != 0 {
                    self
                        .settle_resource(
                            key,
                            resource_type,
                            crate::logic::resources::rule(key.game_id, resource_type).unit_weight,
                            now,
                            start_at,
                        );
                }
            }
        }
        fn spend(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            resource_type: u8,
            amount: u128,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            let rule = super::rule(key.game_id, resource_type);
            self
                .spend_resource(
                    key,
                    resource_type,
                    amount,
                    rule.unit_weight,
                    timestamp.try_into().unwrap(),
                    game_context.production_start,
                );
        }
        fn spend_resource(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            resource_type: u8,
            amount: u128,
            unit_weight: u128,
            now: u32,
            start_at: u32,
        ) {
            let mut resource = self.load_settled(key, resource_type, unit_weight, now, start_at);
            spend(resource_type, ref resource.balance, ref resource.weight, amount, unit_weight);
            self.commit_resource(key, resource_type, resource);
        }
        fn grant_resource(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            resource_type: u8,
            amount: u128,
            unit_weight: u128,
            now: u32,
            start_at: u32,
        ) -> u128 {
            let mut resource = self.load_settled(key, resource_type, unit_weight, now, start_at);
            let granted = add(
                resource_type, ref resource.balance, ref resource.weight, amount, unit_weight, resource.limit,
            );
            self.commit_resource(key, resource_type, resource);
            granted
        }
        fn refill_production(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            resource_type: u8,
            output: u128,
            unit_weight: u128,
            now: u32,
            start_at: u32,
        ) {
            assert_production(resource_type);
            let mut resource = self.load_settled(key, resource_type, unit_weight, now, start_at);
            if !crate::resources::is_unlimited(resource.production.output_amount_left) {
                resource.production.output_amount_left += output;
            }
            self.commit_resource(key, resource_type, resource);
        }
        fn start_production(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            resource_type: u8,
            rate: u64,
            output: u128,
            unit_weight: u128,
            now: u32,
            start_at: u32,
        ) {
            assert_production(resource_type);
            let mut resource = self.load_settled(key, resource_type, unit_weight, now, start_at);
            resource.production.building_count += 1;
            resource.production.production_rate += rate;
            if crate::resources::is_unlimited(output) {
                resource.production.output_amount_left = output;
            } else if !crate::resources::is_unlimited(resource.production.output_amount_left) {
                resource.production.output_amount_left += output;
            }
            self.commit_resource(key, resource_type, resource);
        }
        fn stop_production(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            resource_type: u8,
            rate: u64,
            unit_weight: u128,
            now: u32,
            start_at: u32,
        ) {
            assert_production(resource_type);
            let mut resource = self.load_settled(key, resource_type, unit_weight, now, start_at);
            resource.production.building_count -= 1;
            resource.production.production_rate -= rate;
            self.commit_resource(key, resource_type, resource);
        }
        fn change_structure_capacity(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            amount: u128,
            adding: bool,
            now: u32,
            start_at: u32,
        ) {
            crate::logic::resources::assert_exists(key);
            if crate::logic::resources::weight(key).capacity == 0xffffffffffffffffffffffffffffffff {
                return;
            }
            // Storage only caps what settles, so the old limit must cap what accrued under it.
            self.settle_production(key, now, start_at);
            let mut weight = self.data.resources.weights.read((key.game_id, key.entity_id));
            weight.capacity = if adding {
                weight.capacity + amount
            } else {
                weight.capacity - amount
            };
            if !adding {
                assert!(weight.weight <= weight.capacity, "structure exceeds reduced capacity");
            }
            self.write_weight(key, weight);
        }
        fn load_settled(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            resource_type: u8,
            unit_weight: u128,
            now: u32,
            start_at: u32,
        ) -> SettledResource {
            let mut resource = SettledResource {
                balance: crate::logic::resources::balance(key, resource_type),
                production: crate::logic::resources::production(key, resource_type),
                weight: self.data.resources.weights.read((key.game_id, key.entity_id)),
                limit: crate::logic::resources::store_limit(key, resource_type),
            };
            // Production runs on the armies tick, counted from absolute time, as stamina does.
            let tick_seconds = crate::logic::resources::production_tick(key.game_id);
            let tick = now / tick_seconds;
            let since = core::cmp::max(
                resource.production.last_settled_tick, core::cmp::min(tick, start_at / tick_seconds),
            );
            resource.production.last_settled_tick = since;
            if since != tick {
                settle(
                    resource_type,
                    ref resource.balance,
                    ref resource.production,
                    ref resource.weight,
                    unit_weight,
                    resource.limit,
                    tick,
                    tick_seconds,
                );
            }
            resource
        }

        fn commit_resource(
            ref self: ComponentState<TContractState>, key: ResourceKey, resource_type: u8, resource: SettledResource,
        ) {
            self.write_balance(key, resource_type, resource.balance);
            self.write_production(key, resource_type, resource.production);
            self.write_weight(key, resource.weight);
        }
        #[inline(never)]
        fn write_balance(ref self: ComponentState<TContractState>, key: ResourceKey, resource_type: u8, balance: u128) {
            let storage_key = (key.game_id, key.entity_id, resource_type);
            if self.data.resources.balances.read(storage_key) == balance {
                return;
            }
            self.data.resources.balances.write(storage_key, balance);
            let keys = array![key.game_id.into(), key.entity_id.into(), resource_type.into()].span();
            if balance == 0 {
                self.emit(RowDeleted { version: 1, model: 'ResourceBalance', keys });
            } else {
                self.emit(RowSet { version: 1, model: 'ResourceBalance', keys, values: array![balance.into()].span() });
            }
        }
        #[inline(never)]
        fn write_production(
            ref self: ComponentState<TContractState>, key: ResourceKey, resource_type: u8, production: Production,
        ) {
            if !has_production(resource_type) {
                return;
            }
            let production = if production.building_count == 0 {
                Production { last_settled_tick: 0, ..production }
            } else {
                production
            };
            let storage_key = (key.game_id, key.entity_id, resource_type);
            if self.data.resources.productions.read(storage_key) == production {
                return;
            }
            self.data.resources.productions.write(storage_key, production);
            let keys = array![key.game_id.into(), key.entity_id.into(), resource_type.into()].span();
            if production == Default::default() {
                self.emit(RowDeleted { version: 1, model: 'ResourceProduction', keys });
            } else {
                let mut values = array![];
                production.serialize(ref values);
                self.emit(RowSet { version: 1, model: 'ResourceProduction', keys, values: values.span() });
            }
        }
        #[inline(never)]
        fn write_weight(ref self: ComponentState<TContractState>, key: ResourceKey, weight: Weight) {
            if self.data.resources.weights.read((key.game_id, key.entity_id)) == weight {
                return;
            }
            self.data.resources.weights.write((key.game_id, key.entity_id), weight);
            self.emit_weight(key, weight);
        }
        fn emit_weight(ref self: ComponentState<TContractState>, key: ResourceKey, weight: Weight) {
            let mut values = array![];
            weight.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'ResourceWeight',
                        keys: array![key.game_id.into(), key.entity_id.into()].span(),
                        values: values.span(),
                    },
                );
        }
    }
}
