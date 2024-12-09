use cainome::cairo_serde_derive::CairoSerde;
use serenity::{
    all::{CreateEmbed, CreateEmbedFooter, CreateMessage, Timestamp},
    model::id::ChannelId,
};
use starknet_crypto::Felt;

use crate::{
    constants::ETERNUM_URL,
    types::{DiscordMessage, DiscordMessageType},
    utils::felt_to_string,
};

use super::{ToDiscordMessage, UNKNOWN_USER};

#[derive(CairoSerde, Clone, Copy)]
pub struct HyperstructureFinished {
    pub id: u32,
    pub hyperstructure_entity_id: u32,
    pub contributor_entity_id: u32,
    pub timestamp: u64,
    pub hyperstructure_owner_name: Felt,
}

impl ToDiscordMessage for HyperstructureFinished {
    fn to_discord_message(&mut self, msg_type: DiscordMessageType) -> DiscordMessage {
        let footer = CreateEmbedFooter::new(ETERNUM_URL);
        let embed = CreateEmbed::new()
            .title(format!(
                "{} has finished the construction of hyperstructure {}",
                felt_to_string(&self.hyperstructure_owner_name).unwrap_or(UNKNOWN_USER.to_string()),
                self.hyperstructure_entity_id
            ))
            .color(poise::serenity_prelude::Color::RED)
            .footer(footer)
            .timestamp(Timestamp::now());

        let content = CreateMessage::new()
            .content("HYPERSTRUCTURE FINISHED!")
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
