#[dojo::contract]
mod combat_v2_systems {
    use core::option::OptionTrait;
    use eternum::alias::ID;
    use eternum::models::{
        combatV2::{ArmyImpl, Troop, TroopImpl, Fighters},
        combatV2::{BattleImpl}
    };
    use eternum::systems::combatv2::interface::ICombatv2Contract;

    #[abi(embed_v0)]
    impl Combatv2ContractImpl of ICombatv2Contract<ContractState> {
        fn create_army(world: IWorldDispatcher, entity_id: u128, fighters: Fighters) {
            TroopImpl::create(entity_id, fighters, world); 
        }

        fn merge_army(world: IWorldDispatcher, army_entity_id_a: u128, army_entity_id_b: u128,) {
            // ArmyImpl::merge(entity_id, troops, world);
        }

        fn start_battle(world: IWorldDispatcher, army_entity_id: u128, defending_entity_id: u128) {
            // BattleImpl::start(army_entity_id, defending_entity_id, world);
        }
        
        fn end_battle(world: IWorldDispatcher, battle_entity_id: u128, army_entity_id: u128 ) {
            // BattleImpl::end(army_entity_id, defending_entity_id, world);
        }        
    }
}
