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

use super::{duration_to_string, ToDiscordMessage, UNKNOWN_USER};

// abigen!(
//     _unused,
//     "../contracts/target/dev/s0_eternum_e_BattleStartData.contract_class.json",
// );
// TODO have a build.rs that can load the abis of the types we care about and writes them to a file
// Dojo world can load local world from manifests and retrieve the abi
// We can put these files in the target dir

#[derive(CairoSerde, Clone, Copy)]
pub struct BattleStart {
    pub id: u32,
    pub event_id: u32,
    pub battle_entity_id: u32,
    pub attacker: Felt,
    pub attacker_name: Felt,
    pub attacker_army_entity_id: u32,
    pub defender_name: Felt,
    pub defender: Felt,
    pub defender_army_entity_id: u32,
    pub duration_left: u64,
    pub position: Position,
    pub structure_type: Felt,
    pub timestamp: u64,
}

impl ToDiscordMessage for BattleStart {
    fn to_discord_message(&mut self, msg_type: DiscordMessageType) -> DiscordMessage {
        let duration_string = duration_to_string(self.duration_left);

        let footer = CreateEmbedFooter::new(ETERNUM_URL);
        let normalized_position = self.position.get_normalized();

        let structure_string = match StructureCategory::from(self.structure_type.to_bytes_le()[0]) {
            StructureCategory::NoValue => "".to_string(),
            _ => format!(
                "'s {} ",
                StructureCategory::from(self.structure_type.to_bytes_le()[0])
            ),
        };

        let embed = CreateEmbed::new()
            .title(format!(
                "{} has attacked {} {} at ({}, {})",
                felt_to_string(&self.attacker_name).unwrap_or(UNKNOWN_USER.to_string()),
                felt_to_string(&self.defender_name).unwrap_or(UNKNOWN_USER.to_string()),
                structure_string,
                normalized_position.0,
                normalized_position.1
            ))
            .description(format!("Battle will end in {} seconds", duration_string))
            .image("attachment://ferris_eyes.png")
            .footer(footer)
            .color(poise::serenity_prelude::Color::RED)
            .timestamp(Timestamp::now());

        match msg_type {
            DiscordMessageType::ChannelMessage(channel_id) => {
                let content = CreateMessage::new()
                    .content("BATTLE STARTED!")
                    .embed(embed.clone());
                DiscordMessage::ChannelMessage {
                    channel_id: ChannelId::from(channel_id),
                    content,
                }
            }
            DiscordMessageType::DirectMessage(user_id) => {
                let content = CreateMessage::new()
                    .content(format!("<@{}> BATTLE STARTED!", user_id))
                    .embed(embed.clone());
                DiscordMessage::DirectMessage { user_id, content }
            }
        }
    }

    fn should_send_in_channel_if_no_user_found(&self) -> bool {
        true
    }
}
