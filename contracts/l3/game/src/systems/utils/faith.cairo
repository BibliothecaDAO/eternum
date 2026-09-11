use core::num::traits::Zero;
use dojo::event::EventStorage;
use dojo::model::ModelStorage;
use dojo::world::{IWorldDispatcherTrait, WorldStorage};
use starknet::ContractAddress;
use crate::alias::ID;
use crate::models::config::{FaithConfig, SeasonConfigImpl, WorldConfigUtilImpl};
use crate::models::events::{FaithPointsClaimedStory, Story, StoryEvent};
use crate::models::faith::{FaithfulStructure, PlayerFaithPoints, WonderFaith, WonderFaithWinners};

#[generate_trait]
pub impl FaithAccrualImpl of FaithAccrualTrait {
    fn settle_wonder(
        ref world: WorldStorage, game_id: u32, ref wonder_faith: WonderFaith, now: u64, season_end_at: u64,
    ) {
        // Determine end time (cap at season end)
        let end_time = crate::utils::math::min(season_end_at, now);

        // Skip if no time elapsed or not yet initialized
        if wonder_faith.claim_last_at == 0 || end_time <= wonder_faith.claim_last_at {
            if wonder_faith.claim_last_at == 0 {
                wonder_faith.claim_last_at = now;
                world.write_model(@wonder_faith);
            }
            return;
        }

        // Calculate time elapsed since last claim
        let time_elapsed = end_time - wonder_faith.claim_last_at;

        // Calculate new points
        let new_points: u128 = wonder_faith.claim_per_sec.into() * time_elapsed.into();

        // Update wonder faith
        wonder_faith.claimed_points += new_points;
        wonder_faith.claim_last_at = end_time;
        world.write_model(@wonder_faith);

        // Check and update winners
        let wonder_id = wonder_faith.wonder_id;
        let mut winners: WonderFaithWinners = world.read_model(game_id);

        if wonder_faith.claimed_points > winners.high_score {
            // New high score - replace all previous winners with this one
            winners.high_score = wonder_faith.claimed_points;
            winners.wonder_ids = array![wonder_id];
            world.write_model(@winners);
        } else if wonder_faith.claimed_points == winners.high_score && winners.high_score > 0 {
            // Tied for high score - add to winners if not already present
            let mut already_winner = false;
            for existing_id in winners.wonder_ids.span() {
                if *existing_id == wonder_id {
                    already_winner = true;
                    break;
                }
            }

            if !already_winner {
                winners.wonder_ids.append(wonder_id);
                world.write_model(@winners);
            }
        }

        // Emit event
        world
            .emit_event(
                @StoryEvent {
                    game_id,
                    id: world.dispatcher.uuid(),
                    owner: Option::None,
                    entity_id: Option::Some(wonder_id),
                    tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                    story: Story::FaithPointsClaimedStory(
                        FaithPointsClaimedStory { wonder_id, new_points, total_points: wonder_faith.claimed_points },
                    ),
                    timestamp: now,
                },
            );
    }

    fn update_player_rates(
        ref world: WorldStorage,
        game_id: u32,
        add: bool,
        player: ContractAddress,
        wonder_id: ID,
        owner_delta: u32,
        pledger_delta: u32,
        now: u64,
        season_end_at: u64,
    ) {
        if player.is_zero() {
            return;
        }
        let end_time = crate::utils::math::min(season_end_at, now);
        let mut player_fp: PlayerFaithPoints = world.read_model((game_id, player, wonder_id));
        let time_elapsed = if player_fp.last_updated_at > 0 && end_time > player_fp.last_updated_at {
            end_time - player_fp.last_updated_at
        } else {
            0
        };

        // Claim previously accrued points
        let player_total_points_per_sec = player_fp.points_per_sec_as_owner + player_fp.points_per_sec_as_pledger;
        player_fp.points_claimed += player_total_points_per_sec.into() * time_elapsed.into();
        player_fp.last_updated_at = end_time;

        if add {
            // Update rates (add)
            player_fp.points_per_sec_as_owner += owner_delta;
            player_fp.points_per_sec_as_pledger += pledger_delta;
        } else {
            // Update rates (subtract)
            player_fp.points_per_sec_as_owner -= owner_delta;
            player_fp.points_per_sec_as_pledger -= pledger_delta;
        }
        world.write_model(@player_fp);
    }
}

/// Called by the owner store before its ownership write, for both captures and transfers.
pub fn transfer_faith_ownership(ref world: WorldStorage, game_id: u32, structure_id: ID, new_owner: ContractAddress) {
    let blitz: bool = WorldConfigUtilImpl::get_member(world, game_id, selector!("blitz_mode_on"));
    if blitz {
        return;
    }
    let config: FaithConfig = WorldConfigUtilImpl::get_member(world, game_id, selector!("faith_config"));
    if !config.enabled {
        return;
    }
    let season = SeasonConfigImpl::get(world, game_id);
    let now = starknet::get_block_timestamp();
    let mut wonder: WonderFaith = world.read_model((game_id, structure_id));
    if wonder.last_recorded_owner.is_non_zero() && wonder.last_recorded_owner != new_owner {
        FaithAccrualImpl::settle_wonder(ref world, game_id, ref wonder, now, season.end_at);
        FaithAccrualImpl::update_player_rates(
            ref world,
            game_id,
            false,
            wonder.last_recorded_owner,
            structure_id,
            wonder.owner_claim_per_sec,
            0,
            now,
            season.end_at,
        );
        FaithAccrualImpl::update_player_rates(
            ref world, game_id, true, new_owner, structure_id, wonder.owner_claim_per_sec, 0, now, season.end_at,
        );
        wonder.last_recorded_owner = new_owner;
        world.write_model(@wonder);
    }
    let mut pledge: FaithfulStructure = world.read_model((game_id, structure_id));
    if pledge.wonder_id.is_non_zero() && pledge.last_recorded_owner != new_owner {
        let rate = pledge.fp_to_struct_owner_per_sec.into();
        FaithAccrualImpl::update_player_rates(
            ref world, game_id, false, pledge.last_recorded_owner, pledge.wonder_id, 0, rate, now, season.end_at,
        );
        FaithAccrualImpl::update_player_rates(
            ref world, game_id, true, new_owner, pledge.wonder_id, 0, rate, now, season.end_at,
        );
        pledge.last_recorded_owner = new_owner;
        world.write_model(@pledge);
    }
}
