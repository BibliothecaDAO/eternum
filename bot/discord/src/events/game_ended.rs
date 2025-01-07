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
pub struct GameEnded {
    pub winner_address: Felt,
    pub timestamp: u64,
}

impl ToDiscordMessage for GameEnded {
    fn to_discord_message(&mut self, msg_type: DiscordMessageType) -> DiscordMessage {
        let footer = CreateEmbedFooter::new(ETERNUM_URL);

        let embed = CreateEmbed::new()
            .title(format!(
                "{} accumulated enough points, and decided the season would come to an end. Please give a round of applause to your new Lord!",
                felt_to_string(&self.winner_address).unwrap_or(UNKNOWN_USER.to_string()),
            ))
            .description("The season has been won".to_string())
            .footer(footer)
            .color(poise::serenity_prelude::Color::RED)
            .timestamp(Timestamp::now());

        match msg_type {
            DiscordMessageType::ChannelMessage(channel_id) => {
                let content = CreateMessage::new()
                    .content("GAME ENDED!")
                    .embed(embed.clone());
                DiscordMessage::ChannelMessage {
                    channel_id: ChannelId::from(channel_id),
                    content,
                }
            }
            DiscordMessageType::DirectMessage(user_id) => {
                let content = CreateMessage::new()
                    .content(format!("<@{}> GAME ENDED!", user_id))
                    .embed(embed.clone());
                DiscordMessage::DirectMessage { user_id, content }
            }
        }
    }

    fn should_send_in_channel_if_no_user_found(&self) -> bool {
        true
    }
}
