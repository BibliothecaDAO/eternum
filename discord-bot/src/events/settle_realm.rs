use cainome::cairo_serde_derive::CairoSerde;
use serenity::{
    all::{CreateEmbed, CreateEmbedFooter, CreateMessage, Timestamp},
    model::id::ChannelId,
};
use starknet_crypto::Felt;

use crate::{
    constants::ETERNUM_URL,
    types::{DiscordMessage, DiscordMessageType},
    utils::{felt_to_string, Position},
};

use super::{ToDiscordMessage, UNKNOWN_USER};

#[derive(CairoSerde, Clone, Copy)]
pub struct SettleRealm {
    pub id: u32,
    pub event_id: u32,
    pub entity_id: u32,
    pub owner_address: Felt,
    pub owner_name: Felt,
    pub realm_name: Felt,
    pub produced_resources: u128,
    pub cities: u8,
    pub harbors: u8,
    pub rivers: u8,
    pub regions: u8,
    pub wonder: u8,
    pub order: u8,
    pub position: Position,
    pub timestamp: u64,
}

impl ToDiscordMessage for SettleRealm {
    fn to_discord_message(&mut self, msg_type: DiscordMessageType) -> DiscordMessage {
        let footer = CreateEmbedFooter::new(ETERNUM_URL);
        let normalized_position = self.position.get_normalized();
        let embed = CreateEmbed::new()
            .title(format!(
                "{} has settled {} at ({}, {})",
                felt_to_string(&self.owner_name).unwrap_or(UNKNOWN_USER.to_string()),
                felt_to_string(&self.realm_name).unwrap_or("Unknown Realm".to_string()),
                normalized_position.0,
                normalized_position.1
            ))
            .description("GLHF")
            .footer(footer)
            .color(poise::serenity_prelude::Color::BLURPLE)
            .timestamp(Timestamp::now());

        let content = CreateMessage::new()
            .content("A new Realm has been settled!")
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
