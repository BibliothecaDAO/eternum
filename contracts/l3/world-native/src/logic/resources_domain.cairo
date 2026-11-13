#[starknet::contract]
pub mod ResourcesLogic {
    use starknet::storage::StoragePointerReadAccess;
    use crate::events::RowSet;
    use crate::logic::arrivals::ArrivalState;
    use crate::logic::production::ProductionState;
    use crate::logic::release::ReleaseState;
    use crate::logic::resources::ResourceState;
    use crate::ownership::StoryEvent;
    use crate::resources::ResourceKey;
    use crate::troops::ExplorerKey;

    component!(path: crate::logic::mines::MineState, storage: mines, event: MineEvent);
    impl MineInternal = crate::logic::mines::MineState::InternalImpl<ContractState>;
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    component!(path: ResourceState, storage: resources, event: ResourceEvent);
    component!(path: ArrivalState, storage: arrivals, event: ArrivalEvent);
    component!(path: ProductionState, storage: production, event: ProductionEvent);
    impl LifeInternal = ReleaseState::InternalImpl<ContractState>;
    impl ResourceInternal = ResourceState::InternalImpl<ContractState>;
    impl ArrivalInternal = ArrivalState::InternalImpl<ContractState>;
    impl ProductionInternal = ProductionState::InternalImpl<ContractState>;

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        release: ReleaseState::Storage,
        #[substorage(v0)]
        resources: ResourceState::Storage,
        #[substorage(v0)]
        arrivals: ArrivalState::Storage,
        #[substorage(v0)]
        production: ProductionState::Storage,
        #[substorage(v0)]
        mines: crate::logic::mines::MineState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        MineEvent: crate::logic::mines::MineState::Event,
        ReleaseEvent: ReleaseState::Event,
        ResourceEvent: ResourceState::Event,
        ArrivalEvent: ArrivalState::Event,
        ProductionEvent: ProductionState::Event,
        RowSet: RowSet,
        StoryEvent: StoryEvent,
    }
    #[abi(embed_v0)]
    impl SiteRewards of crate::expeditions::ISiteRewards<ContractState> {
        fn pay_expedition_site(
            ref self: ContractState,
            key: ResourceKey,
            explorer: ExplorerKey,
            home_id: u64,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(key.game_id, context);
            let site = crate::logic::expeditions::expedition_site(key).expect('missing expedition site');
            assert!(site.clear.is_none(), "site already cleared");
            let category = site.category;
            let depth = crate::logic::expeditions::depth_at(
                key.game_id, crate::troops::Coord { alt: site.alt, x: site.col, y: site.row },
            );
            let (reward, clear_xp) = crate::expeditions::ISitePayoutDispatcherTrait::site_payout(
                crate::expeditions::ISitePayoutLibraryDispatcher {
                    class_hash: self.release.classes(key.game_id).construction.read(),
                },
                site,
                depth,
            );
            let home = ResourceKey { game_id: key.game_id, entity_id: home_id };
            let spoils: u128 = crate::logic::triumphs::percent(
                home,
                crate::troops::Coord { alt: site.alt, x: site.col, y: site.row },
                crate::rules::SPOILS_STAGE,
                context.timestamp,
            )
                .into();
            let reward = if let Some(reward) = reward {
                let reward = crate::resources::ResourceAmount { amount: reward.amount * spoils / 100, ..reward };
                let reward = crate::logic::army_relics::site_reward(explorer, reward, context.timestamp);
                let amount = self
                    .grant_resource(
                        home,
                        reward.resource_type,
                        reward.amount,
                        context.timestamp,
                        crate::commands::resource_context(context),
                    );
                Some(crate::resources::ResourceAmount { amount, ..reward })
            } else {
                None
            };
            self.resources.destroy(key);
            crate::logic::expeditions::clear_rewarded_site(
                key, site, crate::expeditions::SiteClear { explorer_id: explorer.explorer_id, home_id, reward }, depth,
            );
            crate::progression::IArmyProgressionDispatcherTrait::grant_army_xp(
                crate::progression::IArmyProgressionLibraryDispatcher {
                    class_hash: self.release.classes(key.game_id).relics.read(),
                },
                explorer,
                crate::progression::XpAward::Clear(
                    (Into::<u32, u128>::into(clear_xp) * spoils / 100).try_into().unwrap(),
                ),
                context.timestamp,
            );
            let actor = crate::logic::structures::structure(home).expect('missing home structure').owner;
            crate::logic::stories::emit_entity_story(
                key,
                actor,
                crate::ownership::Story::SitePayout(
                    crate::expeditions::SitePayout {
                        structure_id: home_id,
                        explorer_id: explorer.explorer_id,
                        site_id: key.entity_id,
                        category,
                        reward,
                    },
                ),
                context.timestamp,
            );
            ()
        }
    }
    #[abi(embed_v0)]
    impl Resources of crate::resources::IResourceOperations<ContractState> {
        fn initialize_explorer_resources(
            ref self: ContractState, key: ResourceKey, amount: u128, game_context: crate::commands::ResourceContext,
        ) {
            self.resources.initialize(key, game_context.troop_capacity.into() * amount);
        }
        fn change_explorer_capacity(
            ref self: ContractState,
            key: ResourceKey,
            amount: u128,
            increase: bool,
            game_context: crate::commands::ResourceContext,
        ) {
            self.resources.change_capacity(key, game_context.troop_capacity.into() * amount, increase);
        }
        fn spend_food(
            ref self: ContractState,
            key: ResourceKey,
            wheat: u128,
            fish: u128,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            self.resources.spend(key, 35, wheat, timestamp, game_context);
            self.resources.spend(key, 36, fish, timestamp, game_context);
        }
        fn spend_spire_fee(
            ref self: ContractState, key: ResourceKey, timestamp: u64, game_context: crate::commands::ResourceContext,
        ) {
            if game_context.spire_fee != 0 {
                self.resources.spend(key, 38, game_context.spire_fee, timestamp, game_context);
            }
        }

        fn initialize_resources(
            ref self: ContractState,
            key: ResourceKey,
            capacity: u128,
            category: u8,
            timestamp: u64,
            game_context: crate::commands::ActionContext,
        ) {
            let game_context = crate::commands::execution_context(key.game_id, game_context);

            self.resources.initialize(key, capacity);
            if category == crate::taxonomy::BITCOIN_MINE_CATEGORY {
                crate::bitcoin::IBitcoinFundingDispatcherTrait::register_bitcoin_structure(
                    crate::bitcoin::IBitcoinFundingLibraryDispatcher {
                        class_hash: self.release.classes(key.game_id).season.read(),
                    },
                    key,
                    category,
                    timestamp,
                    crate::commands::action_context(game_context),
                );
            }
        }
        fn destroy_resources(ref self: ContractState, key: ResourceKey) {
            self.resources.destroy(key);
        }
        fn grant_resource(
            ref self: ContractState,
            key: ResourceKey,
            resource_type: u8,
            amount: u128,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) -> u128 {
            let rule = crate::logic::resources::rule(key.game_id, resource_type);
            self
                .resources
                .grant_resource(
                    key,
                    resource_type,
                    amount,
                    rule.unit_weight,
                    timestamp.try_into().unwrap(),
                    game_context.production_start,
                )
        }
        fn spend_resource(
            ref self: ContractState,
            key: ResourceKey,
            resource_type: u8,
            amount: u128,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            self.resources.spend(key, resource_type, amount, timestamp, game_context);
        }
        fn raise_troops(
            ref self: ContractState,
            key: ResourceKey,
            resource_type: u8,
            amount: u128,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            self.resources.spend(key, resource_type, amount, timestamp, game_context);
            if produces_without_inputs(key.game_id) {
                self.pay_troop_recipe(key, resource_type, amount, timestamp, game_context);
            }
        }
        fn stop_production(
            ref self: ContractState,
            key: ResourceKey,
            resource_type: u8,
            rate: u64,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            self
                .resources
                .stop_production(
                    key,
                    resource_type,
                    rate,
                    crate::logic::resources::rule(key.game_id, resource_type).unit_weight,
                    timestamp.try_into().unwrap(),
                    game_context.production_start,
                );
        }
        fn settle_production(
            ref self: ContractState, key: ResourceKey, timestamp: u64, game_context: crate::commands::ResourceContext,
        ) {
            self.resources.settle_production(key, timestamp.try_into().unwrap(), game_context.production_start);
        }
        fn change_structure_capacity(
            ref self: ContractState,
            key: ResourceKey,
            amount: u128,
            adding: bool,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            self
                .resources
                .change_structure_capacity(
                    key, amount, adding, timestamp.try_into().unwrap(), game_context.production_start,
                );
        }
        fn start_production(
            ref self: ContractState,
            key: ResourceKey,
            resource_type: u8,
            rate: u64,
            output: u128,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            let rule = crate::logic::resources::rule(key.game_id, resource_type);
            self
                .resources
                .start_production(
                    key,
                    resource_type,
                    rate,
                    output,
                    rule.unit_weight,
                    timestamp.try_into().unwrap(),
                    game_context.production_start,
                );
        }
    }
    #[abi(embed_v0)]
    impl EconomyDelivery of crate::trade::IEconomyDelivery<ContractState> {
        fn queue_economy_delivery(
            ref self: ContractState,
            key: ResourceKey,
            resource: crate::resources::ResourceAmount,
            travel_time: u64,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            let _ = crate::logic::resources::rule(key.game_id, resource.resource_type);

            let arrival = crate::arrivals::arrival_key(
                key.game_id, key.entity_id, game_context.delivery_tick, timestamp, travel_time,
            );
            self.arrivals.enqueue(arrival, array![resource].span());
        }
    }

    #[abi(embed_v0)]
    impl ExplorationGrant of crate::exploration_rewards::IExplorationGrant<ContractState> {
        fn grant_exploration_reward(
            ref self: ContractState,
            key: ResourceKey,
            resource_type: u8,
            amount: u128,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            let rule = crate::logic::resources::rule(key.game_id, resource_type);
            self
                .resources
                .grant_resource(
                    key,
                    resource_type,
                    amount,
                    rule.unit_weight,
                    timestamp.try_into().unwrap(),
                    game_context.production_start,
                );
        }
    }

    // A board's buildings produce for ever from nothing, so its troops are paid for when they are raised.
    // Each Rations pick cuts the wheat a deployed troop costs; the cut is per troop, the recipe per `per_troops`.
    fn ration_cut(key: ResourceKey, per_troops: u128) -> u128 {
        let board = crate::logic::preset_record::for_game(key.game_id).board_terms.read().unwrap();
        let rations: u128 = crate::research::picks(
            crate::logic::research::learned(key), crate::research::ROW_BARRACKS, crate::research::CHOICE_RATIONS,
        )
            .into();
        rations * board.ration_step * per_troops / crate::rules::RESOURCE_PRECISION
    }

    fn produces_without_inputs(game_id: u32) -> bool {
        crate::logic::preset_record::for_game(game_id).board_terms.read().is_some()
    }

    #[generate_trait]
    impl Internal of InternalTrait {
        fn pay_troop_recipe(
            ref self: ContractState,
            key: ResourceKey,
            resource_type: u8,
            troops: u128,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            let recipe = self.production.recipe(crate::production::RecipeKey { game_id: key.game_id, resource_type });
            let per_troops: u128 = recipe.simple_output.into();
            let ration_cut = ration_cut(key, per_troops);
            let now: u32 = timestamp.try_into().unwrap();
            for input in recipe.simple_inputs {
                let unit_weight = crate::logic::resources::rule(key.game_id, *input.resource_type).unit_weight;
                let amount = if *input.resource_type == crate::resources::WHEAT {
                    *input.amount - core::cmp::min(*input.amount, ration_cut)
                } else {
                    *input.amount
                };
                // A realm never underpays a fraction of a recipe.
                let cost = (amount * troops + per_troops - 1) / per_troops;
                let (previous, mut stock) = self
                    .resources
                    .load_settled(key, *input.resource_type, unit_weight, now, game_context.production_start);
                assert!(stock.balance >= cost, "realm cannot pay to raise troops");
                crate::resources::spend(*input.resource_type, ref stock.balance, ref stock.weight, cost, unit_weight);
                self.resources.commit_resource(key, *input.resource_type, previous, stock);
            }
        }
    }
}
