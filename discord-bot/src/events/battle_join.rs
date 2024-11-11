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

use super::{duration_to_string, ToDiscordMessage, UNKNOWN_USER};
#[allow(dead_code)]
#[derive(CairoSerde)]
pub struct BattleJoin {
    pub id: u32,
    pub event_id: u32,
    pub battle_entity_id: u32,
    pub joiner: Felt,
    pub joiner_name: Felt,
    pub joiner_army_entity_id: u32,
    pub joiner_side: Felt,
    pub duration_left: u64,
    pub position: Position,
}

impl ToDiscordMessage for BattleJoin {
    fn to_discord_message(&mut self, msg_type: DiscordMessageType) -> DiscordMessage {
        let duration_string = duration_to_string(self.duration_left);

        let footer = CreateEmbedFooter::new(ETERNUM_URL);
        let normalized_position = self.position.get_normalized();
        let embed = CreateEmbed::new()
            .title(format!(
                "{} has joined the battle at ({}, {})",
                felt_to_string(&self.joiner_name).unwrap_or(UNKNOWN_USER.to_string()),
                normalized_position.0,
                normalized_position.1
            ))
            .description(format!("Battle will end in {} seconds", duration_string))
            .footer(footer)
            .color(poise::serenity_prelude::Color::RED)
            .timestamp(Timestamp::now());

        let content = CreateMessage::new()
            .content("BATTLE JOINED!")
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
        false
    }
}
