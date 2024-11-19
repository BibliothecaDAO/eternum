use cainome::cairo_serde_derive::CairoSerde;
use serenity::{
    all::{CreateEmbed, CreateEmbedFooter, CreateMessage, Timestamp},
    model::id::ChannelId,
};
use starknet_crypto::Felt;

use crate::{
    constants::ETERNUM_URL,
    eternum_enums::{BuildingCategory, ResourceIds, StructureCategory},
    types::{DiscordMessage, DiscordMessageType},
    utils::{felt_to_string, Position},
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
    pub pillaged_structure_owner_name: Felt,
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
                format!("{} {}", amount / 1000, ResourceIds::from(*resource_id),)
            })
            .collect::<Vec<String>>()
            .join(", ");

        let resources = if resources.is_empty() {
            "No resources were pillaged".to_string()
        } else {
            format!("Resources pillaged: {}", resources)
        };

        let destroyed_building_string =
            match BuildingCategory::from(self.structure_type.to_bytes_le()[0]) {
                BuildingCategory::NoValue => "No building was destroyed".to_string(),
                BuildingCategory::Castle => "No building was destroyed".to_string(),
                _ => format!(
                    "A {} was destroyed in the process",
                    BuildingCategory::from(self.structure_type.to_bytes_le()[0])
                ),
            };

        let embed = CreateEmbed::new()
            .title(format!(
                "{} has pillaged {}'s {} at ({}, {})",
                felt_to_string(&self.pillager_name).unwrap_or(UNKNOWN_USER.to_string()),
                felt_to_string(&self.pillaged_structure_owner_name)
                    .unwrap_or(UNKNOWN_USER.to_string()),
                StructureCategory::from(self.structure_type.to_bytes_le()[0]),
                normalized_position.0,
                normalized_position.1
            ))
            .description(format!("{}\n{}", resources, destroyed_building_string))
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
