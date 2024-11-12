use cainome::cairo_serde_derive::CairoSerde;
use serenity::{
    all::{CreateEmbed, CreateEmbedFooter, CreateMessage, Timestamp},
    model::id::ChannelId,
};
use starknet_crypto::Felt;

use crate::{
    constants::ETERNUM_URL,
    types::{DiscordMessage, DiscordMessageType},
    utils::{felt_to_string, Position, ResourceIds},
};

use super::{ToDiscordMessage, UNKNOWN_USER};

#[derive(CairoSerde, Clone)]
pub struct BattlePillage {
    pub id: u32,
    pub event_id: u32,
    pub pillager: Felt,
    pub pillager_name: Felt,
    pub pillager_realm_entity_id: u32,
    pub pillager_army_entity_id: u32,
    pub pillaged_structure_owner: Felt,
    pub pillaged_structure_entity_id: u32,
    pub winner: Felt,
    pub position: Position,
    pub structure_type: Felt,
    pub pillaged_resources: Vec<(u8, u128)>,
}

impl ToDiscordMessage for BattlePillage {
    fn to_discord_message(&mut self, msg_type: DiscordMessageType) -> DiscordMessage {
        let footer = CreateEmbedFooter::new(ETERNUM_URL);
        let normalized_position = self.position.get_normalized();

        self.pillaged_resources.swap_remove(0);

        let resources = self
            .pillaged_resources
            .iter()
            .map(|(resource_id, amount)| {
                format!("{}: {}", ResourceIds::from(*resource_id), amount / 1000)
            })
            .collect::<Vec<String>>()
            .join(", ");

        let embed = CreateEmbed::new()
            .title(format!(
                "{} has pillaged a structure at ({}, {})",
                felt_to_string(&self.pillager_name).unwrap_or(UNKNOWN_USER.to_string()),
                normalized_position.0,
                normalized_position.1
            ))
            .description(format!(
                "Pillaged resources: {:?}\nStructure type: {}",
                resources,
                felt_to_string(&self.structure_type).unwrap_or(UNKNOWN_USER.to_string())
            ))
            .footer(footer)
            .color(poise::serenity_prelude::Color::RED)
            .timestamp(Timestamp::now());

        let content = CreateMessage::new()
            .content("STRUCTURE PILLAGED!")
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
