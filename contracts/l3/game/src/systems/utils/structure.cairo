use core::num::traits::Zero;
use dojo::event::EventStorage;
use dojo::world::{IWorldDispatcherTrait, WorldStorage};
use crate::alias::ID;
use crate::constants::DAYDREAMS_AGENT_ID;
use crate::models::config::{VictoryPointsGrantConfig, WorldConfigUtilImpl};
use crate::models::events::{PointsActivity, PointsRegisteredStory, Story, StoryEvent};
use crate::models::hyperstructure::PlayerRegisteredPointsImpl;
use crate::models::map::TileImpl;
use crate::models::position::CoordImpl;
use crate::models::resource::resource::{
    ResourceImpl, ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, TroopResourceImpl, WeightStoreImpl,
};
use crate::models::structure::{
    StructureBase, StructureBaseStoreImpl, StructureCategory, StructureImpl, StructureMetadataStoreImpl,
    StructureOwnerStoreImpl, StructureResourcesImpl, StructureTroopExplorerStoreImpl, StructureTroopGuardStoreImpl,
};
use crate::models::troop::{ExplorerTroops, GuardTrait, GuardTroops, TroopsImpl};
use crate::systems::utils::map::IMapImpl;
use crate::systems::utils::troop::iExplorerImpl;


#[generate_trait]
pub impl iStructureImpl of IStructureTrait {
    fn battle_claim(
        ref world: WorldStorage,
        game_id: u32,
        ref structure_guards: GuardTroops,
        ref structure_base: StructureBase,
        ref explorer: ExplorerTroops,
        structure_id: ID,
    ) {
        if explorer.owner != DAYDREAMS_AGENT_ID {
            let blitz_mode_on: bool = WorldConfigUtilImpl::get_member(world, game_id, selector!("blitz_mode_on"));
            let season_mode_on: bool = !blitz_mode_on;
            if season_mode_on {
                // villages can't be claimed in season mode
                if structure_base.category == StructureCategory::Village.into() {
                    return;
                }
            }

            // reset all guard troops
            structure_guards.reset_all_slots();
            StructureTroopGuardStoreImpl::store(ref structure_guards, ref world, game_id, structure_id);

            // get previous owner
            let previous_owner_address: starknet::ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, game_id, structure_id,
            );

            // get new owner
            let explorer_owner_address: starknet::ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, game_id, explorer.owner,
            );
            // store new owner
            StructureOwnerStoreImpl::store(explorer_owner_address, ref world, game_id, structure_id);

            // grant victory points to player for conquering hyperstructure
            let structure_was_owned_by_bandits: bool = previous_owner_address.is_zero();
            let victory_points_grant_config: VictoryPointsGrantConfig = WorldConfigUtilImpl::get_member(
                world, game_id, selector!("victory_points_grant_config"),
            );
            if structure_was_owned_by_bandits && structure_base.category == StructureCategory::Hyperstructure.into() {
                PlayerRegisteredPointsImpl::register_points(
                    ref world,
                    game_id,
                    explorer_owner_address,
                    victory_points_grant_config.claim_hyperstructure_points.into(),
                );
                let points_registered_story = PointsRegisteredStory {
                    owner_address: explorer_owner_address,
                    activity: PointsActivity::HyperStructureBanditsDefeat,
                    points: victory_points_grant_config.claim_hyperstructure_points.into(),
                };
                world
                    .emit_event(
                        @StoryEvent {
                            game_id,
                            id: world.dispatcher.uuid(),
                            owner: Option::Some(explorer_owner_address),
                            entity_id: Option::Some(structure_id),
                            tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                            story: Story::PointsRegisteredStory(points_registered_story),
                            timestamp: starknet::get_block_timestamp(),
                        },
                    );
            }

            // grant victory points to player for conquering other structures
            if structure_was_owned_by_bandits && structure_base.category != StructureCategory::Hyperstructure.into() {
                let victory_points_grant_config: VictoryPointsGrantConfig = WorldConfigUtilImpl::get_member(
                    world, game_id, selector!("victory_points_grant_config"),
                );
                PlayerRegisteredPointsImpl::register_points(
                    ref world,
                    game_id,
                    explorer_owner_address,
                    victory_points_grant_config.claim_otherstructure_points.into(),
                );

                let points_registered_story = PointsRegisteredStory {
                    owner_address: explorer_owner_address,
                    activity: PointsActivity::OtherStructureBanditsDefeat,
                    points: victory_points_grant_config.claim_otherstructure_points.into(),
                };
                world
                    .emit_event(
                        @StoryEvent {
                            game_id,
                            id: world.dispatcher.uuid(),
                            owner: Option::Some(explorer_owner_address),
                            entity_id: Option::Some(structure_id),
                            tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                            story: Story::PointsRegisteredStory(points_registered_story),
                            timestamp: starknet::get_block_timestamp(),
                        },
                    );
            }
        }
    }
    //

}
