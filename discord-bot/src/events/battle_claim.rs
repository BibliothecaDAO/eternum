use cainome::cairo_serde_derive::CairoSerde;
use serenity::{
    all::{CreateEmbed, CreateEmbedFooter, CreateMessage, Timestamp},
    model::id::ChannelId,
};
use starknet_crypto::Felt;

use crate::{
    constants::ETERNUM_URL,
    eternum_enums::StructureCategory,
    types::{DiscordMessage, DiscordMessageType},
    utils::{felt_to_string, Position},
};

use super::{ToDiscordMessage, UNKNOWN_USER};

#[derive(CairoSerde, Clone, Copy)]
pub struct BattleClaim {
    pub id: u32,
    pub event_id: u32,
    pub structure_entity_id: u32,
    pub claimer: Felt,
    pub claimer_name: Felt,
    pub claimer_army_entity_id: u32,
    pub claimee_address: Felt,
    pub claimee_name: Felt,
    pub position: Position,
    pub structure_type: Felt,
}

impl ToDiscordMessage for BattleClaim {
    fn to_discord_message(&mut self, msg_type: DiscordMessageType) -> DiscordMessage {
        let footer = CreateEmbedFooter::new(ETERNUM_URL);
        let normalized_position = self.position.get_normalized();
        let embed = CreateEmbed::new()
            .title(format!(
                "{} has claimed {}'s {} at ({}, {})",
                felt_to_string(&self.claimer_name).unwrap_or(UNKNOWN_USER.to_string()),
                felt_to_string(&self.claimee_name).unwrap_or(UNKNOWN_USER.to_string()),
                StructureCategory::from(self.structure_type.to_bytes_le()[0]),
                normalized_position.0,
                normalized_position.1
            ))
            .description(format!(
                "Structure type: {}",
                felt_to_string(&self.structure_type).unwrap_or(UNKNOWN_USER.to_string())
            ))
            .color(poise::serenity_prelude::Color::RED)
            .footer(footer)
            .timestamp(Timestamp::now());

        let content = CreateMessage::new()
            .content("STRUCTURE CLAIMED!")
            .embed(embed.clone());

        match msg_type {
            DiscordMessageType::ChannelMessage(channel_id) => DiscordMessage::ChannelMessage {
                channel_id: ChannelId::from(channel_id),
                content,
            },
            DiscordMessageType::DirectMessage(user_id) => {
                DiscordMessage::DirectMessage { user_id, content }
            }
        }
    }

    fn should_send_in_channel_if_no_user_found(&self) -> bool {
        true
    }
}
