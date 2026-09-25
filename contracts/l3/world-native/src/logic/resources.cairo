use starknet::storage::StorageMapReadAccess;
use crate::resources::{Production, ResourceKey, Weight, assert_resource, has_production};

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
    use crate::logic::production::ProductionState;
    use crate::logic::production::ProductionState::InternalTrait as RecipeInternal;
    use crate::production::RecipeKey;
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
    pub impl InternalImpl<
        TContractState, +HasComponent<TContractState>, impl Recipes: ProductionState::HasComponent<TContractState>,
    > of InternalTrait<TContractState> {
        fn write_lords_budget(ref self: ComponentState<TContractState>, game_id: u32, lords_committed: u128) {
            self.data.relics.lords_committed.write(game_id, Some(lords_committed));
            self
                .emit(
                    crate::events::RowSet {
                        version: 1,
                        model: 'LordsBudget',
                        keys: array![game_id.into()].span(),
                        values: array![lords_committed.into()].span(),
                    },
                );
        }

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
            let granted = add(resource_type, ref resource.balance, ref resource.weight, amount, unit_weight);
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
            resource.production.output_amount_left += output;
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
            if crate::resources::is_troop_resource(resource_type) && output == crate::resources::UNLIMITED_OUTPUT {
                self
                    .settle_resource(
                        key, 35, crate::logic::resources::rule(key.game_id, 35).unit_weight, now, start_at,
                    );
            }
            let mut resource = self.load_settled(key, resource_type, unit_weight, now, start_at);
            resource.production.building_count += 1;
            resource.production.production_rate += rate;
            resource
                .production
                .output_amount_left =
                    if output == crate::resources::UNLIMITED_OUTPUT {
                        output
                    } else {
                        resource.production.output_amount_left + output
                    };
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
            ref self: ComponentState<TContractState>, key: ResourceKey, amount: u128, adding: bool,
        ) {
            crate::logic::resources::assert_exists(key);
            let mut weight = self.data.resources.weights.read((key.game_id, key.entity_id));
            if weight.capacity == 0xffffffffffffffffffffffffffffffff {
                return;
            }
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
            if resource_type == 35 || crate::resources::is_troop_resource(resource_type) {
                self.settle_training(key, now, start_at);
            }
            let mut resource = SettledResource {
                balance: crate::logic::resources::balance(key, resource_type),
                production: crate::logic::resources::production(key, resource_type),
                weight: self.data.resources.weights.read((key.game_id, key.entity_id)),
            };
            resource
                .production
                .last_updated_at = core::cmp::max(resource.production.last_updated_at, core::cmp::min(now, start_at));
            if resource.production.last_updated_at != now {
                settle(
                    resource_type, ref resource.balance, ref resource.production, ref resource.weight, unit_weight, now,
                );
            }
            resource
        }

        fn settle_training(ref self: ComponentState<TContractState>, key: ResourceKey, now: u32, start_at: u32) {
            let mut trainers = array![];
            for resource_type in crate::resources::FIRST_TROOP_RESOURCE..(crate::resources::LAST_TROOP_RESOURCE + 1) {
                let production = crate::logic::resources::production(key, resource_type);
                if production.output_amount_left == crate::resources::UNLIMITED_OUTPUT
                    && production.building_count != 0
                    && production.last_updated_at != now {
                    trainers.append((resource_type, production));
                }
            }
            if trainers.is_empty() {
                return;
            }

            let mut wheat = crate::logic::resources::production(key, 35);
            let wheat_weight = crate::logic::resources::rule(key.game_id, 35).unit_weight;
            let stored_wheat = crate::logic::resources::balance(key, 35);
            let mut available = stored_wheat;
            if wheat.building_count != 0 {
                let since = core::cmp::max(wheat.last_updated_at, core::cmp::min(now, start_at));
                available += Into::<u32, u128>::into(now - since) * wheat.production_rate.into();
            }
            wheat.last_updated_at = now;
            let mut outputs = array![];
            for (resource_type, mut production) in trainers {
                let recipe = get_dep_component!(@self, Recipes)
                    .recipe(RecipeKey { game_id: key.game_id, resource_type });
                assert!(recipe.simple_output != 0 && recipe.simple_inputs.len() == 1, "training needs a simple recipe");
                let input = *recipe.simple_inputs.at(0);
                assert!(input.resource_type == 35 && input.amount != 0, "training requires wheat");
                let since = core::cmp::max(production.last_updated_at, core::cmp::min(now, start_at));
                let expected = Into::<u32, u128>::into(now - since) * production.production_rate.into();
                let per_cycle: u128 = recipe.simple_output.into();
                let trained = core::cmp::min(expected, available * per_cycle / input.amount);
                available -= (trained * input.amount + per_cycle - 1) / per_cycle;
                production.last_updated_at = now;
                outputs.append((resource_type, production, trained));
            }

            // Training consumes farm output before storage burns any surplus.
            let mut weight = crate::logic::resources::weight(key);
            let mut wheat_balance = stored_wheat;
            spend(35, ref wheat_balance, ref weight, stored_wheat, wheat_weight);
            add(35, ref wheat_balance, ref weight, available, wheat_weight);
            self.write_balance(key, 35, wheat_balance);
            self.write_production(key, 35, wheat);
            for (resource_type, production, trained) in outputs {
                let mut balance = crate::logic::resources::balance(key, resource_type);
                add(
                    resource_type,
                    ref balance,
                    ref weight,
                    trained,
                    crate::logic::resources::rule(key.game_id, resource_type).unit_weight,
                );
                self.write_balance(key, resource_type, balance);
                self.write_production(key, resource_type, production);
            }
            self.write_weight(key, weight);
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
                Production { last_updated_at: 0, ..production }
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
