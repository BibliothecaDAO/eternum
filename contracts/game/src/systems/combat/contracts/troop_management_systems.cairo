use s1_eternum::alias::ID;
use s1_eternum::models::position::Direction;
use s1_eternum::models::troop::{GuardSlot, TroopTier, TroopType};


#[starknet::interface]
trait ITroopManagementSystems<TContractState> {
    // guard
    fn guard_add(
        ref self: TContractState,
        for_structure_id: ID,
        slot: GuardSlot,
        category: TroopType,
        tier: TroopTier,
        amount: u128,
    );
    fn guard_delete(ref self: TContractState, for_structure_id: ID, slot: GuardSlot);

    // explorer
    fn explorer_create(
        ref self: TContractState, for_structure_id: ID, category: TroopType, tier: TroopTier, amount: u128,
    ) -> ID;
    fn explorer_add(ref self: TContractState, to_explorer_id: ID, category: TroopType, tier: TroopTier, amount: u128);
    fn explorer_swap(
        ref self: TContractState,
        from_explorer_id: ID,
        to_explorer_id: ID,
        to_explorer_direction: Direction,
        count: u128,
    );
    fn explorer_delete(ref self: TContractState, explorer_id: ID);
}


#[dojo::contract]
mod troop_management_systems {
    use core::num::traits::Bounded;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use s1_eternum::alias::ID;
    use s1_eternum::constants::{DEFAULT_NS, RESOURCE_PRECISION, ResourceTypes, WORLD_CONFIG_ID};
    use s1_eternum::models::{
        config::{
            BattleConfigTrait, CapacityConfig, CombatConfigImpl, SpeedConfig, TickConfig, TickImpl, TickTrait,
            TroopLimitConfig, TroopStaminaConfig, WorldConfigUtilImpl,
        },
        map::{Tile, TileImpl}, owner::{EntityOwner, EntityOwnerTrait, Owner, OwnerAddressTrait},
        position::{Coord, CoordTrait, Direction, OccupiedBy, Occupier, OccupierTrait, Position, PositionTrait},
        resource::{
            resource::{
                Resource, ResourceImpl, ResourceWeightImpl, SingleResource, SingleResourceImpl, SingleResourceStoreImpl,
                StructureSingleResourceFoodImpl, WeightStoreImpl,
            },
            resource::{ResourceList},
        },
        season::SeasonImpl, stamina::{Stamina, StaminaTrait}, structure::{Structure, StructureCategory, StructureTrait},
        troop::{
            ExplorerTroops, GuardImpl, GuardSlot, GuardTrait, GuardTroops, TroopTier, TroopType, Troops, TroopsTrait,
        },
        weight::{Weight, WeightTrait},
    };
    use s1_eternum::systems::utils::map::iMapImpl;

    use s1_eternum::systems::utils::{mine::iMineDiscoveryImpl, troop::{iExplorerImpl, iTroopImpl}};

    use s1_eternum::utils::map::{biomes::{Biome, get_biome}};

    use super::ITroopManagementSystems;

    #[abi(embed_v0)]
    impl TroopManagementSystemsImpl of ITroopManagementSystems<ContractState> {
        fn guard_add(
            ref self: ContractState,
            for_structure_id: ID,
            slot: GuardSlot,
            category: TroopType,
            tier: TroopTier,
            amount: u128,
        ) {
            assert!(amount.is_non_zero(), "amount must be greater than 0");

            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure caller owns structure
            let mut structure: Structure = world.read_model(for_structure_id);
            structure.owner.assert_caller_owner();

            // deduct resources used to create guard
            let tick = TickImpl::get_tick_config(ref world);
            let current_tick: u64 = tick.current().try_into().unwrap();
            iTroopImpl::make_payment(ref world, for_structure_id, amount, category, tier, current_tick);

            // ensure guard slot is valid
            let mut guard: GuardTroops = structure.guards;
            let (mut troops, troops_destroyed_tick): (Troops, u32) = guard.from_slot(slot);

            // ensure delay from troop defeat is over
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            if troops_destroyed_tick.is_non_zero() {
                let next_troop_update_at = troops_destroyed_tick
                    + tick.convert_from_seconds(troop_limit_config.guard_resurrection_delay.into()).try_into().unwrap();
                assert!(
                    current_tick >= next_troop_update_at.into(),
                    "you need to wait for the delay from troop defeat to be over",
                );
            }

            if troops.count.is_zero() {
                // ensure structure has not reached the hard limit of guards
                assert!(
                    structure.guard_count < structure.limits.max_guard_count, "reached limit of guards per structure",
                );

                // update guard count
                structure.guard_count += 1;

                // set category and tier
                troops.category = category;
                troops.tier = tier;
            }

            troops.count += amount;
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            troops.stamina.refill(troops.category, troop_stamina_config, current_tick);

            // update guard slot and structure
            guard.to_slot(slot, troops, current_tick);
            structure.guards = guard;
            world.write_model(@structure);
        }


        fn guard_delete(ref self: ContractState, for_structure_id: ID, slot: GuardSlot) {
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure caller owns structure
            let mut structure: Structure = world.read_model(for_structure_id);
            structure.owner.assert_caller_owner();

            // deduct resources used to create guard
            let tick = TickImpl::get_tick_config(ref world);
            let current_tick: u64 = tick.current().try_into().unwrap();

            // ensure guard slot is valid
            let mut guard: GuardTroops = structure.guards;
            let (mut troops, troops_destroyed_tick): (Troops, u32) = guard.from_slot(slot);

            // ensure delay from troop defeat is over
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            if troops_destroyed_tick.is_non_zero() {
                let next_troop_update_at = troops_destroyed_tick
                    + tick.convert_from_seconds(troop_limit_config.guard_resurrection_delay.into()).try_into().unwrap();
                assert!(
                    current_tick >= next_troop_update_at.into(),
                    "you need to wait for the delay from troop defeat to be over",
                );
            }

            // clear troop
            troops.count = 0;
            troops.stamina.reset(current_tick);
            guard.to_slot(slot, troops, current_tick);
            structure.guards = guard;

            // reduce structure guard count
            structure.guard_count -= 1;

            // update structure
            world.write_model(@structure);
        }


        fn explorer_create(
            ref self: ContractState, for_structure_id: ID, category: TroopType, tier: TroopTier, amount: u128,
        ) -> ID {
            assert!(amount.is_non_zero(), "amount must be greater than 0");

            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure caller owns structure
            let mut structure: Structure = world.read_model(for_structure_id);
            structure.owner.assert_caller_owner();

            // deduct resources used to create explorer
            let tick = TickImpl::get_tick_config(ref world);
            let current_tick: u64 = tick.current().try_into().unwrap();
            iTroopImpl::make_payment(ref world, for_structure_id, amount, category, tier, current_tick);

            // ensure structure has not reached itslimit of troops
            assert!(
                structure.explorers.len() < structure.limits.max_explorer_count,
                "reached limit of troops for your structure",
            );

            // ensure structure has not reached hard limit of explorers for all structures
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            assert!(
                structure.explorers.len() < troop_limit_config.explorer_max_party_count.into(),
                "reached limit of troops per structure",
            );

            // create explorer
            let mut explorer_id: ID = world.dispatcher.uuid();

            // add explorer count to structure
            let mut explorers: Array<ID> = structure.explorers.into();
            explorers.append(explorer_id);
            structure.explorers = explorers.span();
            world.write_model(@structure);

            // add explorer to location occupier
            let coord: Coord = structure.coord;
            let mut occupier: Occupier = world.read_model((coord.x, coord.y));
            occupier.entity = OccupiedBy::Explorer(explorer_id);
            world.write_model(@occupier);

            // ensure explorer amount does not exceed max
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            assert!(
                amount <= troop_limit_config.explorer_max_troop_count.into() * RESOURCE_PRECISION,
                "reached limit of explorers amount per armys",
            );

            // set troop stamina
            let mut troops = Troops { category, tier, count: amount, stamina: Stamina { amount: 0, updated_tick: 0 } };
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            troops.stamina.refill(troops.category, troop_stamina_config, current_tick);

            // set explorer
            world
                .write_model(
                    @ExplorerTroops {
                        explorer_id,
                        coord,
                        troops,
                        owner: EntityOwner { entity_id: explorer_id, entity_owner_id: structure.entity_id },
                    },
                );

            explorer_id
        }

        fn explorer_add(
            ref self: ContractState, to_explorer_id: ID, category: TroopType, tier: TroopTier, amount: u128,
        ) {
            assert!(amount.is_non_zero(), "amount must be greater than 0");

            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure caller owns explorer
            let mut explorer: ExplorerTroops = world.read_model(to_explorer_id);
            explorer.owner.assert_caller_owner(world);

            // ensure explorer is at home
            let owner_structure_id: ID = explorer.owner.entity_owner_id;
            let explorer_owner_structure: Structure = world.read_model(owner_structure_id);
            assert!(explorer_owner_structure.coord == explorer.coord, "explorer not at home structure");

            // deduct resources used to create explorer
            let tick = TickImpl::get_tick_config(ref world);
            let current_tick: u64 = tick.current().try_into().unwrap();
            iTroopImpl::make_payment(ref world, owner_structure_id, amount, category, tier, current_tick);

            // add troops to explorer
            explorer.troops.count += amount;
            world.write_model(@explorer);

            // update troop capacity
            iExplorerImpl::update_capacity(ref world, to_explorer_id, explorer, amount, true);

            // ensure explorer count does not exceed max count
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            assert!(
                explorer.troops.count <= troop_limit_config.explorer_max_troop_count.into() * RESOURCE_PRECISION,
                "reached limit of explorers amount per armys",
            );
        }

        fn explorer_swap(
            ref self: ContractState,
            from_explorer_id: ID,
            to_explorer_id: ID,
            to_explorer_direction: Direction,
            count: u128,
        ) {
            assert!(count.is_non_zero(), "count must be greater than 0");

            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure caller address owns both explorers
            // (not necessarily the same structure)
            let mut from_explorer: ExplorerTroops = world.read_model(from_explorer_id);
            from_explorer.owner.assert_caller_owner(world);

            let mut to_explorer: ExplorerTroops = world.read_model(to_explorer_id);
            to_explorer.owner.assert_caller_owner(world);

            // ensure explorers are adjacent to one another
            let to_explorer_coord = to_explorer.coord.neighbor(to_explorer_direction);
            let to_explorer_occupier: Occupier = world.read_model(to_explorer_coord);
            assert!(
                to_explorer_occupier.entity == OccupiedBy::Explorer(to_explorer_id),
                "to explorer is not at the target coordinate",
            );

            // ensure both explorers have troops
            assert!(from_explorer.troops.count.is_non_zero(), "from explorer has no troops");
            assert!(to_explorer.troops.count.is_zero(), "to explorer has troops");

            // update troops
            from_explorer.troops.count -= count;
            to_explorer.troops.count += count;

            // update troop capacity
            iExplorerImpl::update_capacity(ref world, from_explorer_id, from_explorer, count, false);
            iExplorerImpl::update_capacity(ref world, to_explorer_id, to_explorer, count, true);

            // get current tick
            let tick = TickImpl::get_tick_config(ref world);
            let current_tick: u64 = tick.current().try_into().unwrap();

            // ensure there is no stamina advantage gained by swapping
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            from_explorer.troops.stamina.refill(from_explorer.troops.category, troop_stamina_config, current_tick);
            to_explorer.troops.stamina.refill(to_explorer.troops.category, troop_stamina_config, current_tick);
            if from_explorer.troops.stamina.amount < to_explorer.troops.stamina.amount {
                to_explorer.troops.stamina.amount = from_explorer.troops.stamina.amount;
            }

            // update explorer models
            world.write_model(@from_explorer);
            world.write_model(@to_explorer);

            // ensure to_explorer count does not exceed max count
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            assert!(
                to_explorer.troops.count <= troop_limit_config.explorer_max_troop_count.into() * RESOURCE_PRECISION,
                "reached limit of explorers amount per armys",
            );
        }

        fn explorer_delete(ref self: ContractState, explorer_id: ID) {
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure caller owns explorer
            let mut explorer: ExplorerTroops = world.read_model(explorer_id);
            explorer.owner.assert_caller_owner(world);

            // delete explorer
            iExplorerImpl::explorer_delete(ref world, ref explorer);
        }
    }
}
