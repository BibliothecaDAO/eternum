use cainome::cairo_serde_derive::CairoSerde;
use serenity::{
    all::{CreateEmbed, CreateEmbedFooter, CreateMessage, Timestamp},
    model::id::ChannelId,
};
use starknet_crypto::Felt;

use crate::{
    constants::ETERNUM_URL,
    eternum_enums::BattleSide,
    types::{DiscordMessage, DiscordMessageType},
    utils::{felt_to_string, Position},
};

use super::{duration_to_string, ToDiscordMessage, UNKNOWN_USER};

#[derive(CairoSerde, Clone, Copy)]
pub struct BattleLeave {
    pub id: u32,
    pub event_id: u32,
    pub battle_entity_id: u32,
    pub leaver: Felt,
    pub leaver_name: Felt,
    pub leaver_army_entity_id: u32,
    pub leaver_side: Felt,
    pub duration_left: u64,
    pub position: Position,
    pub timestamp: u64,
}

impl ToDiscordMessage for BattleLeave {
    fn to_discord_message(&mut self, msg_type: DiscordMessageType) -> DiscordMessage {
        let duration_string = duration_to_string(self.duration_left);

        let footer = CreateEmbedFooter::new(ETERNUM_URL);
        let normalized_position = self.position.get_normalized();
        let embed = CreateEmbed::new()
            .title(format!(
                "{} has left a battle at ({}, {}), he was on the {} side. Wuss",
                felt_to_string(&self.leaver_name).unwrap_or(UNKNOWN_USER.to_string()),
                normalized_position.0,
                normalized_position.1,
                BattleSide::from(self.leaver_side.to_bytes_le()[0])
            ))
            .description(format!("Battle will end in {} seconds", duration_string))
            .footer(footer)
            .color(poise::serenity_prelude::Color::RED)
            .timestamp(Timestamp::now());

        let content = CreateMessage::new()
            .content("BATTLE LEFT!")
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
