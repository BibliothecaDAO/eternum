use eternum::alias::ID;
use eternum::models::combat::Duty;

use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait ISoldierSystems<TContractState> {
    /// Create a number of soldiers for a realm
    ///
    /// # Arguments
    ///
    /// * `world` - The world address
    /// * `entity_id` - The realm's entity id of the realm
    /// * `quantity` - The number of soldiers to create
    ///
    fn create_soldiers( 
            self: @TContractState, world: IWorldDispatcher, 
            realm_entity_id: u128, quantity: u128
    ) -> Span<ID>;
    ///  Create a group of soldiers and deploy them
    ///  assign them a duty.
    ///
    ///  What differentiates 
    ///
    /// # Arguments
    ///
    /// * `world` - The world address
    /// * `entity_id` - The realm's entity id of the realm
    /// * `soldier_ids` - The ids of the soldiers that'll make up the group
    /// * `duty` - The duty of the group which can be either attack or defence.
    ///             Those assigned to attack will be deployed to raid other realms
    ///             while those assigned to defence will be deployed to defend the realm.
    ///             This means those attacking can travel and hold resources in inventory
    ///             while those defending cannot as they are deployed to the realm's town watch.      
    ///             
    ///
    fn group_and_deploy_soldiers( 
        self: @TContractState, world: IWorldDispatcher, 
        realm_entity_id: u128, soldier_ids: Span<ID>, duty: Duty
    ) -> ID;
    /// Remove all soldiers from a group and make them individual soldiers
    ///
    /// Note: If the group is a raiding unit, they must not hold any resources
    ///       in their inventory.
    ///
    /// # Arguments
    ///
    /// * `world` - The world address
    /// * `group_id` - The group's entity id
    ///
    fn ungroup_soldiers(
        self: @TContractState, world: IWorldDispatcher, group_id: ID
    ) -> Span<ID>;
}

#[starknet::interface]
trait ICombatSystems<TContractState> {
    fn attack( 
        self: @TContractState, world: IWorldDispatcher, 
        attacker_ids:Span<u128>, target_realm_entity_id: u128
    );
    fn steal( 
            self: @TContractState, world: IWorldDispatcher, 
            attacker_id:u128, target_realm_entity_id: u128
    );
}